"use server";

/**
 * Upload de foto com registro de autorização (#46), em três passos:
 *
 * 1. `prepararUpload` confere a autorização e devolve uma URL assinada para um
 *    caminho gerado aqui (`{cafe_id}/{uuid}.webp`);
 * 2. o navegador sobe o WebP direto para o Storage — o arquivo não passa pela
 *    Server Action nem pela Vercel;
 * 3. `registrarFoto` grava a linha em `cafe_fotos` (o trigger atualiza
 *    `cafes.fotos`) e invalida o cache. Se o registro falha, o arquivo é
 *    apagado: não existe foto no bucket sem autorização registrada.
 *
 * Se o passo 3 nem chega ao servidor, o formulário chama `descartarUpload`.
 * Depois de no ar, a foto muda de posição (`reordenarFoto`) ou sai
 * (`removerFoto`) — #51. Quem decide o acesso, em cada passo, é a RLS (`private.is_admin()`).
 */
import { revalidatePath } from "next/cache";

import { BUCKET_FOTOS } from "@/lib/cafe-photos";
import { fotoRegistrada, getCafeById, listFotosDoCafe } from "@/lib/cafe-repository";
import { moverFoto, ordensParaGravar, type Movimento } from "@/lib/foto-ordem";
import {
  caminhoDaFoto,
  checarWebp,
  ehCaminhoDoCafe,
  hojeEmRecife,
  validarAutorizacao,
  type CampoAutorizacao,
} from "@/lib/foto-upload";
import { falhaDoPostgres, falhaDoStorage, type Etapa, type Falha } from "@/lib/foto-upload-erro";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin, sessaoDeAdmin } from "./require-admin";
import { revalidarCafe } from "./revalidar";

export type CamposAutorizacao = Partial<Record<CampoAutorizacao, unknown>>;

/**
 * `falha` diz a etapa e a causa (#74); o formulário a traduz em frase com
 * `mensagemDaFalha`. Erro de campo vem em `erros`, com `falha: null`.
 */
export type ResultadoFoto =
  | { ok: true }
  | { ok: false; falha: Falha | null; erros?: Partial<Record<CampoAutorizacao, string>> };

type FalhaFoto = Extract<ResultadoFoto, { ok: false }>;

export type ResultadoPreparo = { ok: true; caminho: string; url: string } | FalhaFoto;

function autorizacao(campos: CamposAutorizacao) {
  return validarAutorizacao(campos ?? {}, hojeEmRecife(new Date()));
}

/**
 * Registra a falha nos logs da Vercel e a devolve. Só etapa, causa, café e
 * caminho: a mensagem original já vem saneada (sem URL assinada nem token).
 */
function falhou(falha: Falha, contexto: { cafeId: unknown; caminho?: unknown }): FalhaFoto {
  const { cafeId, caminho } = contexto;
  console.error(`[fotos] ${falha.etapa} falhou`, { ...falha, cafeId: String(cafeId), caminho });
  return { ok: false, falha };
}

/**
 * A sessão expirou (ou perdeu o segundo fator) com o formulário aberto: a
 * action explica em vez de redirecionar, para a foto e os campos não sumirem.
 */
const sessaoExpirada = (etapa: Etapa): FalhaFoto => ({ ok: false, falha: { etapa, codigo: "sessao" } });

/** Modo leitura (#75): fora da produção, nada sobe nem é registrado. */
const modoLeitura = (etapa: Etapa): FalhaFoto => ({ ok: false, falha: { etapa, codigo: "modo-leitura" } });

/** Passo 1: autorização e arquivo conferidos antes de qualquer byte subir. */
export async function prepararUpload(
  cafeId: string,
  campos: CamposAutorizacao,
  arquivo: { type: string; size: number },
): Promise<ResultadoPreparo> {
  if (!(await sessaoDeAdmin())) return sessaoExpirada("preparar");
  if (bloqueioDeEscrita()) return modoLeitura("preparar");

  const validacao = autorizacao(campos);
  if (!validacao.ok) return { ok: false, falha: null, erros: validacao.erros };

  const tipo = String(arquivo?.type);
  // O cliente já barra; aqui é quem contornou o formulário. A frase do bucket serve.
  if (checarWebp({ type: tipo, size: Number(arquivo?.size) })) {
    return { ok: false, falha: { etapa: "preparar", codigo: tipo === "image/webp" ? "413" : "415" } };
  }

  const cafe = await getCafeById(String(cafeId));
  if (!cafe) return falhou({ etapa: "preparar", codigo: "cafe" }, { cafeId });

  const caminho = caminhoDaFoto(cafe.id, crypto.randomUUID());
  const { data, error } = await createSessionClient().storage.from(BUCKET_FOTOS).createSignedUploadUrl(caminho);
  if (error || !data) return falhou(falhaDoStorage("preparar", error), { cafeId, caminho });

  return { ok: true, caminho, url: data.signedUrl };
}

/** Passo 3: registra a foto já no bucket. Qualquer falha apaga o arquivo. */
export async function registrarFoto(
  cafeId: string,
  caminho: string,
  campos: CamposAutorizacao,
): Promise<ResultadoFoto> {
  if (!(await sessaoDeAdmin())) return sessaoExpirada("registrar");
  if (bloqueioDeEscrita()) return modoLeitura("registrar");
  if (!ehCaminhoDoCafe(cafeId, caminho)) return falhou({ etapa: "registrar", codigo: "desconhecido" }, { cafeId });

  const supabase = createSessionClient();
  const fotos = supabase.storage.from(BUCKET_FOTOS);
  /** Apaga o arquivo; se nem isso der, a falha avisa do órfão (com o caminho). */
  const falhar = async (falha: Falha | null, erros?: FalhaFoto["erros"]): Promise<FalhaFoto> => {
    const { error } = await fotos.remove([caminho]);
    const comOrfao = error && falha ? { ...falha, orfao: true, caminho } : falha;
    if (!comOrfao) return { ok: false, falha: null, erros };
    return { ...falhou(comOrfao, { cafeId, caminho }), erros };
  };

  const validacao = autorizacao(campos);
  if (!validacao.ok) return falhar(null, validacao.erros);

  const cafe = await getCafeById(cafeId);
  if (!cafe) return falhar({ etapa: "registrar", codigo: "cafe" });

  // O upload pode ter falhado sem o navegador perceber: sem arquivo, sem linha.
  // O storage-js lança (em vez de devolver `error`) para o que não é 400/404.
  let existe: boolean;
  try {
    ({ data: existe } = await fotos.exists(caminho));
  } catch (erro) {
    return falhou({ ...falhaDoStorage("registrar", erro), codigo: "exists" }, { cafeId, caminho });
  }
  if (!existe) return falhou({ etapa: "registrar", codigo: "sem-arquivo" }, { cafeId, caminho });

  const { error } = await supabase
    .from("cafe_fotos")
    .insert({ cafe_id: cafe.id, storage_path: caminho, ...validacao.valores });
  if (error) return falhar(falhaDoPostgres(error));

  revalidarFotos(cafe.slug);
  return { ok: true };
}

/** O site (capa, carrossel) e o painel inteiro: a lista (nº de fotos) e esta página. */
function revalidarFotos(slug: string) {
  revalidarCafe(slug);
  revalidatePath("/admin", "layout");
}

/**
 * O registro não respondeu (rede caiu): apaga o arquivo, a menos que a linha
 * tenha sido gravada mesmo assim — aí a foto está no ar e fica.
 */
export async function descartarUpload(cafeId: string, caminho: string): Promise<void> {
  // Sem sessão não há o que fazer (a RLS barraria): o formulário já explicou.
  if (!(await sessaoDeAdmin())) return;
  if (bloqueioDeEscrita()) return;
  if (!ehCaminhoDoCafe(cafeId, caminho)) return;
  if (await fotoRegistrada(caminho)) return;

  await createSessionClient().storage.from(BUCKET_FOTOS).remove([caminho]);
}

export type ResultadoAcaoFoto = { ok: true } | { ok: false; erro: string };

const ERRO_FOTO = "Esta foto não foi encontrada. Recarregue a página.";
const ERRO_ORDEM = "Não deu para mudar a ordem agora. Tente de novo em instantes.";
const ERRO_REMOCAO = "Não deu para remover a foto agora. Tente de novo em instantes.";

/** Café e foto conferidos no servidor: o id vindo do cliente precisa ser de uma foto deste café. */
async function fotoDoCafe(cafeId: string, fotoId: string) {
  const cafe = await getCafeById(String(cafeId));
  if (!cafe) return null;
  const fotos = await listFotosDoCafe(cafe.id);
  const foto = fotos.find((f) => f.id === fotoId);
  return foto ? { cafe, fotos, foto } : null;
}

/**
 * Sobe, desce ou leva a foto para a capa. Grava `ordem` = posição só onde
 * muda; uma gravação que falhe no meio deixa um estado válido (sem `unique`,
 * empate cai no `criado_em`) que a próxima tentativa corrige.
 */
export async function reordenarFoto(cafeId: string, fotoId: string, movimento: Movimento): Promise<ResultadoAcaoFoto> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const achado = await fotoDoCafe(cafeId, fotoId);
  if (!achado) return { ok: false, erro: ERRO_FOTO };
  const { cafe, fotos } = achado;

  const nova = moverFoto(
    fotos.map((f) => f.id),
    fotoId,
    movimento,
  );
  if (!nova) return { ok: false, erro: ERRO_ORDEM };

  const supabase = createSessionClient();
  for (const { id, ordem } of ordensParaGravar(fotos, nova)) {
    // A RLS não dá erro, só não grava: sem a linha afetada, não houve mudança.
    const { error, count } = await supabase
      .from("cafe_fotos")
      .update({ ordem }, { count: "exact" })
      .eq("id", id)
      .eq("cafe_id", cafe.id);
    if (error || count !== 1) {
      revalidarFotos(cafe.slug);
      return { ok: false, erro: ERRO_ORDEM };
    }
  }

  revalidarFotos(cafe.slug);
  return { ok: true };
}

/**
 * Apaga a linha e depois o arquivo — nessa ordem: se o Storage falhar, sobra
 * um arquivo órfão (inofensivo, fora do site), nunca uma linha apontando para
 * um arquivo que não existe. Sem a última foto, o trigger esvazia
 * `cafes.fotos` e o café volta ao placeholder.
 */
export async function removerFoto(cafeId: string, fotoId: string): Promise<ResultadoAcaoFoto> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const achado = await fotoDoCafe(cafeId, fotoId);
  if (!achado) return { ok: false, erro: ERRO_FOTO };
  const { cafe, foto } = achado;

  const supabase = createSessionClient();
  const { error, count } = await supabase
    .from("cafe_fotos")
    .delete({ count: "exact" })
    .eq("id", foto.id)
    .eq("cafe_id", cafe.id);
  // A RLS não dá erro, só não apaga: o arquivo só sai se a linha saiu de fato.
  if (error || count !== 1) return { ok: false, erro: ERRO_REMOCAO };

  await supabase.storage.from(BUCKET_FOTOS).remove([foto.storage_path]);
  revalidarFotos(cafe.slug);
  return { ok: true };
}
