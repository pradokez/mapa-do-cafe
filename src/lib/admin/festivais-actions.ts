"use server";

/**
 * Admin dos festivais (#102): edições (datas, descrição, preço, publicar) e
 * participantes (adicionar, número, nome curto, alt, post, remover). A
 * validação é a mesma dos formulários (`festival-dados`), mas é esta que vale.
 * Quem decide o acesso é a RLS (`private.is_admin()`). Escrita sem `.select`:
 * o que precisa ser relido passa pelo `cafe-repository`.
 */
import { isUuid } from "@/lib/admin-auth";
import { getCafeById, getEdicaoById, listFestivaisCadastrados } from "@/lib/cafe-repository";
import { urlDaEdicao, type Edicao } from "@/lib/festival";
import {
  donoDoNumero,
  erroDePublicacao,
  validarEdicao,
  validarParticipante,
  type ErrosEdicao,
  type ErrosParticipante,
} from "@/lib/festival-dados";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin } from "./require-admin";
import { revalidarFestivais } from "./revalidar";

export type ResultadoFestival = { ok: true } | { ok: false; erro: string };
export type ResultadoCadastroEdicao = { ok: true; id: string } | { ok: false; erro: string | null; erros?: ErrosEdicao };
export type ResultadoSalvarEdicao = { ok: true } | { ok: false; erro: string | null; erros?: ErrosEdicao };
export type ResultadoSalvarParticipante =
  | { ok: true }
  | { ok: false; erro: string | null; erros?: ErrosParticipante };

const ERRO_GERAL = "Não deu para salvar agora. Tente de novo em instantes.";
const ERRO_EDICAO = "Esta edição não foi encontrada.";
const ERRO_PARTICIPANTE = "Este café não está mais nesta edição. Recarregue a página.";

/** Violação de `unique` no Postgres. */
const UNICO = "23505";

const anoRepetido = (edicao: Pick<Edicao, "festival">, ano: number) =>
  `Já existe ${edicao.festival.nome} ${ano}. Abra essa edição na lista para editar.`;

async function edicaoDoId(id: unknown): Promise<Edicao | null> {
  return typeof id === "string" && isUuid(id) ? getEdicaoById(id) : null;
}

/**
 * Cadastra uma edição **fora do ar** (rascunho): a administradora completa os
 * participantes e publica quando estiver pronta. O festival só se escolhe aqui;
 * o `id` sai do servidor, para a tela abrir a edição sem `.select` na escrita.
 */
export async function cadastrarEdicao(festivalSlug: string, campos: unknown): Promise<ResultadoCadastroEdicao> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const validacao = validarEdicao(campos);
  if (!validacao.ok) return { ok: false, erro: null, erros: validacao.erros };

  const festival = (await listFestivaisCadastrados()).find((f) => f.slug === festivalSlug);
  if (!festival) return { ok: false, erro: "Escolha o festival." };

  const id = crypto.randomUUID();
  const { error } = await createSessionClient()
    .from("festival_edicoes")
    .insert({ id, festival_id: festival.id, ...validacao.valores, publicada: false });
  if (error?.code === UNICO) {
    return { ok: false, erro: null, erros: { inicio: anoRepetido({ festival }, validacao.valores.ano) } };
  }
  if (error) return { ok: false, erro: ERRO_GERAL };

  // Fora do ar, o site não muda; o painel sim.
  revalidarFestivais({ festival, ano: validacao.valores.ano });
  return { ok: true, id };
}

/** Datas, descrição e preço. Festival e publicação não mudam por aqui. */
export async function salvarEdicao(edicaoId: string, campos: unknown): Promise<ResultadoSalvarEdicao> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const validacao = validarEdicao(campos);
  if (!validacao.ok) return { ok: false, erro: null, erros: validacao.erros };

  const edicao = await edicaoDoId(edicaoId);
  if (!edicao) return { ok: false, erro: ERRO_EDICAO };
  if (edicao.publicada && validacao.valores.preco === null) {
    return {
      ok: false,
      erro: null,
      erros: { preco: "Edição publicada precisa de preço. Despublique antes de apagar." },
    };
  }

  // Update barrado pela RLS não dá erro: só não muda linha nenhuma.
  const { error, count } = await createSessionClient()
    .from("festival_edicoes")
    .update(validacao.valores, { count: "exact" })
    .eq("id", edicao.id);
  if (error?.code === UNICO) {
    return { ok: false, erro: null, erros: { inicio: anoRepetido(edicao, validacao.valores.ano) } };
  }
  if (error || count !== 1) return { ok: false, erro: ERRO_GERAL };

  // Mudou o ano, mudou o endereço da página: o antigo também sai do cache.
  revalidarFestivais({ festival: edicao.festival, ano: validacao.valores.ano }, urlDaEdicao(edicao));
  return { ok: true };
}

/**
 * Publica ou despublica. Recebe o estado desejado, não um "alternar": repetir
 * a chamada (clique duplo, duas abas) não desfaz o que a primeira fez.
 */
export async function definirPublicacao(edicaoId: string, publicada: boolean): Promise<ResultadoFestival> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };
  if (typeof publicada !== "boolean") return { ok: false, erro: ERRO_GERAL };

  const edicao = await edicaoDoId(edicaoId);
  if (!edicao) return { ok: false, erro: ERRO_EDICAO };
  const impedimento = publicada ? erroDePublicacao(edicao) : null;
  if (impedimento) return { ok: false, erro: impedimento };

  const { error, count } = await createSessionClient()
    .from("festival_edicoes")
    .update({ publicada }, { count: "exact" })
    .eq("id", edicao.id);
  if (error || count !== 1) return { ok: false, erro: ERRO_GERAL };

  revalidarFestivais(edicao);
  return { ok: true };
}

/** Põe um café no ar na edição, sem número nem arte (o selo e o filtro já valem). */
export async function adicionarParticipante(edicaoId: string, cafeId: string): Promise<ResultadoFestival> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const [edicao, cafe] = await Promise.all([
    edicaoDoId(edicaoId),
    typeof cafeId === "string" && isUuid(cafeId) ? getCafeById(cafeId) : null,
  ]);
  if (!edicao) return { ok: false, erro: ERRO_EDICAO };
  // Café fora do ar não aparece no site como participante (RLS): nem entra.
  if (!cafe?.ativo) return { ok: false, erro: "Este café não está no ar." };

  const repetido = `${cafe.nome} já está nesta edição.`;
  if (edicao.participacoes.some((p) => p.cafe_id === cafe.id)) return { ok: false, erro: repetido };

  const { error } = await createSessionClient()
    .from("festival_participacoes")
    .insert({ edicao_id: edicao.id, cafe_id: cafe.id });
  if (error?.code === UNICO) return { ok: false, erro: repetido };
  if (error) return { ok: false, erro: ERRO_GERAL };

  revalidarFestivais(edicao);
  return { ok: true };
}

/** Número, nome curto, alt e link do post. A arte (e a autorização) não mudam por aqui. */
export async function salvarParticipante(
  edicaoId: string,
  participacaoId: string,
  campos: unknown,
): Promise<ResultadoSalvarParticipante> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const edicao = await edicaoDoId(edicaoId);
  if (!edicao) return { ok: false, erro: ERRO_EDICAO };
  const participacao = edicao.participacoes.find((p) => p.id === participacaoId);
  if (!participacao) return { ok: false, erro: ERRO_PARTICIPANTE };

  const validacao = validarParticipante(campos, { temArte: participacao.arte !== null });
  if (!validacao.ok) return { ok: false, erro: null, erros: validacao.erros };
  const { numero } = validacao.valores;

  const dono = donoDoNumero(edicao.participacoes, participacao.id, numero);
  if (dono) {
    const cafe = await getCafeById(dono.cafe_id);
    return { ok: false, erro: null, erros: { numero: `O número ${numero} já é de ${cafe?.nome ?? "outro café"}.` } };
  }

  const { error, count } = await createSessionClient()
    .from("festival_participacoes")
    .update(validacao.valores, { count: "exact" })
    .eq("id", participacao.id);
  // Outra aba gravou o mesmo número entre a leitura e a escrita.
  if (error?.code === UNICO) {
    return { ok: false, erro: null, erros: { numero: `O número ${numero} já é de outro café.` } };
  }
  if (error || count !== 1) return { ok: false, erro: ERRO_GERAL };

  revalidarFestivais(edicao);
  return { ok: true };
}

/**
 * Tira o café da edição: some o selo, o filtro e o combo dele. Só a linha —
 * a arte no bucket, quando houver, é assunto da fatia das artes.
 */
export async function removerParticipante(edicaoId: string, participacaoId: string): Promise<ResultadoFestival> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const edicao = await edicaoDoId(edicaoId);
  if (!edicao) return { ok: false, erro: ERRO_EDICAO };
  const participacao = edicao.participacoes.find((p) => p.id === participacaoId);
  if (!participacao) return { ok: false, erro: ERRO_PARTICIPANTE };

  const { error, count } = await createSessionClient()
    .from("festival_participacoes")
    .delete({ count: "exact" })
    .eq("id", participacao.id);
  if (error || count !== 1) return { ok: false, erro: "Não deu para tirar o café agora. Tente de novo em instantes." };

  revalidarFestivais(edicao);
  return { ok: true };
}
