"use server";

/**
 * Arte do combo de um participante (#105), pelo fluxo das fotos (#46):
 *
 * 1. `prepararArte` confere a autorização e devolve uma URL assinada para um
 *    caminho gerado aqui (`{edicao_id}/{uuid}.webp`, bucket `festival-artes`);
 * 2. o navegador sobe o WebP direto para o Storage;
 * 3. `registrarArte` grava, numa escrita só, os dados do participante, a arte
 *    e a autorização (o `check` do banco exige alt e autorização com a arte).
 *    Falhou, o arquivo novo sai; deu certo, sai o antigo (troca).
 *
 * Se o passo 3 nem chega ao servidor, o formulário chama `descartarArte`.
 * `removerArte` tira a arte (linha antes do arquivo). Quem decide o acesso é a
 * RLS (`private.is_admin()`).
 */
import { arteRegistrada, getEdicaoById, listArtesDaEdicao } from "@/lib/cafe-repository";
import { BUCKET_ARTES } from "@/lib/festival";
import {
  donoDoNumero,
  validarParticipante,
  type CampoParticipante,
  type DadosParticipante,
} from "@/lib/festival-dados";
import {
  caminhoDaArte,
  checarWebp,
  ehCaminhoDaEdicao,
  hojeEmRecife,
  validarAutorizacaoDaArte,
  type CampoAutorizacaoDaArte,
} from "@/lib/foto-upload";
import { falhaDoPostgres, falhaDoStorage, type Etapa, type Falha } from "@/lib/foto-upload-erro";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin, sessaoDeAdmin } from "./require-admin";
import { revalidarFestivais } from "./revalidar";

export type CampoArte = CampoParticipante | CampoAutorizacaoDaArte;
export type ErrosArte = Partial<Record<CampoArte, string>>;

/** Como no upload de foto (#74): `falha` crua, que o formulário traduz; erro de campo em `erros`. */
type FalhaArte = { ok: false; falha: Falha | null; erros?: ErrosArte };
export type ResultadoPreparoArte = { ok: true; caminho: string; url: string } | FalhaArte;
export type ResultadoArte = { ok: true; valores: DadosParticipante } | FalhaArte;
export type ResultadoRemoverArte = { ok: true } | { ok: false; erro: string };

const sessaoExpirada = (etapa: Etapa): FalhaArte => ({ ok: false, falha: { etapa, codigo: "sessao" } });
const modoLeitura = (etapa: Etapa): FalhaArte => ({ ok: false, falha: { etapa, codigo: "modo-leitura" } });

/** Log da Vercel com etapa, causa, edição e caminho — nunca URL assinada nem token. */
function falhou(falha: Falha, contexto: { edicaoId: unknown; caminho?: unknown }): FalhaArte {
  console.error(`[artes] ${falha.etapa} falhou`, { ...falha, edicaoId: String(contexto.edicaoId), caminho: contexto.caminho });
  return { ok: false, falha };
}

const autorizacao = (campos: unknown) =>
  validarAutorizacaoDaArte(campos && typeof campos === "object" ? (campos as Record<string, unknown>) : {}, hojeEmRecife(new Date()));

/** Edição e participação conferidas no servidor: o id vindo do cliente precisa ser desta edição. */
async function participacaoDaEdicao(edicaoId: string, participacaoId: string) {
  const edicao = await getEdicaoById(String(edicaoId));
  const participacao = edicao?.participacoes.find((p) => p.id === participacaoId);
  return edicao && participacao ? { edicao, participacao } : null;
}

const bucket = () => createSessionClient().storage.from(BUCKET_ARTES);

/** Passo 1: autorização e arquivo conferidos antes de qualquer byte subir. */
export async function prepararArte(
  edicaoId: string,
  participacaoId: string,
  campos: Partial<Record<CampoAutorizacaoDaArte, unknown>>,
  arquivo: { type: string; size: number },
): Promise<ResultadoPreparoArte> {
  if (!(await sessaoDeAdmin())) return sessaoExpirada("preparar");
  if (bloqueioDeEscrita()) return modoLeitura("preparar");

  const validacao = autorizacao(campos);
  if (!validacao.ok) return { ok: false, falha: null, erros: validacao.erros };

  const tipo = String(arquivo?.type);
  // O cliente já barra; aqui é quem contornou o formulário. A frase do bucket serve.
  if (checarWebp({ type: tipo, size: Number(arquivo?.size) })) {
    return { ok: false, falha: { etapa: "preparar", codigo: tipo === "image/webp" ? "413" : "415" } };
  }

  const achado = await participacaoDaEdicao(edicaoId, participacaoId);
  if (!achado) return falhou({ etapa: "preparar", codigo: "participante" }, { edicaoId });

  const caminho = caminhoDaArte(achado.edicao.id, crypto.randomUUID());
  const { data, error } = await bucket().createSignedUploadUrl(caminho);
  if (error || !data) return falhou(falhaDoStorage("preparar", error), { edicaoId, caminho });

  return { ok: true, caminho, url: data.signedUrl };
}

/**
 * Passo 3: grava dados, arte e autorização numa escrita só. Qualquer falha
 * apaga o arquivo novo; sucesso apaga o antigo, se havia.
 */
export async function registrarArte(
  edicaoId: string,
  participacaoId: string,
  caminho: string,
  campos: unknown,
): Promise<ResultadoArte> {
  if (!(await sessaoDeAdmin())) return sessaoExpirada("registrar");
  if (bloqueioDeEscrita()) return modoLeitura("registrar");
  // Caminho de outra edição (ou forjado): não é nosso para apagar.
  if (!ehCaminhoDaEdicao(edicaoId, caminho)) return falhou({ etapa: "registrar", codigo: "desconhecido" }, { edicaoId });

  const artes = bucket();
  /** Apaga o arquivo novo; se nem isso der, a falha avisa do órfão (com o caminho). */
  const falhar = async (falha: Falha | null, erros?: ErrosArte): Promise<FalhaArte> => {
    const { error } = await artes.remove([caminho]);
    const comOrfao = error && falha ? { ...falha, orfao: true, caminho } : falha;
    if (!comOrfao) return { ok: false, falha: null, erros };
    return { ...falhou(comOrfao, { edicaoId, caminho }), erros };
  };

  // A arte vai junto: o alt passa a ser obrigatório.
  const dados = validarParticipante(campos, { temArte: true });
  const quem = autorizacao(campos);
  if (!dados.ok || !quem.ok) {
    return falhar(null, { ...(dados.ok ? {} : dados.erros), ...(quem.ok ? {} : quem.erros) });
  }

  const achado = await participacaoDaEdicao(edicaoId, participacaoId);
  if (!achado) return falhar({ etapa: "registrar", codigo: "participante" });
  const { edicao, participacao } = achado;

  const { numero } = dados.valores;
  if (donoDoNumero(edicao.participacoes, participacao.id, numero)) {
    return falhar(null, { numero: `O número ${numero} já é de outro café nesta edição.` });
  }

  // O upload pode ter falhado sem o navegador perceber: sem arquivo, sem linha.
  let existe: boolean;
  try {
    ({ data: existe } = await artes.exists(caminho));
  } catch (erro) {
    return falhou({ ...falhaDoStorage("registrar", erro), codigo: "exists" }, { edicaoId, caminho });
  }
  if (!existe) return falhou({ etapa: "registrar", codigo: "sem-arquivo" }, { edicaoId, caminho });

  const antigo = (await listArtesDaEdicao(edicao.id))[participacao.id]?.caminho;
  const { error, count } = await createSessionClient()
    .from("festival_participacoes")
    .update({ ...dados.valores, arte_path: caminho, ...quem.valores }, { count: "exact" })
    .eq("id", participacao.id);
  // Outra aba gravou o mesmo número entre a leitura e a escrita.
  if (error?.code === "23505" && error.message.includes("numero")) {
    return falhar(null, { numero: `O número ${numero} já é de outro café nesta edição.` });
  }
  if (error) return falhar(falhaDoPostgres(error));
  // A RLS não dá erro, só não grava.
  if (count !== 1) return falhar({ etapa: "registrar", codigo: "42501" });

  // A troca não deixa o arquivo antigo no bucket. Se falhar, sobra um órfão inofensivo.
  if (antigo && antigo !== caminho) await artes.remove([antigo]);
  revalidarFestivais(edicao);
  return { ok: true, valores: dados.valores };
}

/**
 * O registro não respondeu (rede caiu): apaga o arquivo, a menos que a linha
 * tenha sido gravada mesmo assim — aí a arte está no ar e fica.
 */
export async function descartarArte(edicaoId: string, caminho: string): Promise<void> {
  // Sem sessão não há o que fazer (a RLS barraria): o formulário já explicou.
  if (!(await sessaoDeAdmin())) return;
  if (bloqueioDeEscrita()) return;
  if (!ehCaminhoDaEdicao(edicaoId, caminho)) return;
  if (await arteRegistrada(caminho)) return;

  await bucket().remove([caminho]);
}

const ERRO_REMOCAO = "Não deu para remover a arte agora. Tente de novo em instantes.";

/**
 * Tira a arte do participante (ele continua na edição): limpa arte e
 * autorização na linha e depois apaga o arquivo — nessa ordem, como nas
 * fotos: falha no Storage deixa um órfão inofensivo, nunca uma linha
 * apontando para um arquivo que não existe.
 */
export async function removerArte(edicaoId: string, participacaoId: string): Promise<ResultadoRemoverArte> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const achado = await participacaoDaEdicao(edicaoId, participacaoId);
  if (!achado) return { ok: false, erro: "Este café não está mais nesta edição. Recarregue a página." };
  const { edicao, participacao } = achado;

  const caminho = (await listArtesDaEdicao(edicao.id))[participacao.id]?.caminho;
  const { error, count } = await createSessionClient()
    .from("festival_participacoes")
    .update({ arte_path: null, autorizado_por: null, autorizado_em: null }, { count: "exact" })
    .eq("id", participacao.id);
  if (error || count !== 1) return { ok: false, erro: ERRO_REMOCAO };

  if (caminho) await bucket().remove([caminho]);
  revalidarFestivais(edicao);
  return { ok: true };
}
