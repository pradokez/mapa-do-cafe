/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { unstable_cache } from "next/cache";

import { isUuid } from "./admin-auth";
import { CAFE_COLUMNS, compararPorNome, type Cafe } from "./cafe";
import { urlsPublicasDasFotos } from "./cafe-photos";
import { urlPublicaDaArte, type Edicao, type FestivalSlug, type Participacao } from "./festival";
import type { Autorizacao, AutorizacaoDaArte } from "./foto-upload";
import { STATUS_SUGESTAO, type ContagemDeSugestoes, type StatusSugestao, type Sugestao } from "./sugestao";
import { createAnonClient, createSessionClient } from "./supabase-server";
import { supabaseEnv } from "./supabase-env";

const SELECT_CAFE = CAFE_COLUMNS.join(", ");

/** `cafes.fotos` guarda caminhos no bucket; quem lê o café recebe URLs públicas. */
function comFotosPublicas(cafe: Cafe): Cafe {
  return { ...cafe, fotos: urlsPublicasDasFotos(cafe.fotos, supabaseEnv().url) };
}

/** Tag do cache da listagem pública — o admin a invalida (`revalidarCafe`). */
export const CAFES_TAG = "cafes";

/**
 * Cafés ativos em ordem alfabética (pt-BR, ignorando acento e caixa).
 *
 * Em cache por 1 h: a home é dinâmica (lê os params de filtro), mas não há por
 * que ir ao Supabase a cada visita. O Data Cache da Vercel sobrevive a deploys,
 * então o commit entra na chave: deploy novo, cache novo. Mutation do admin
 * invalida a tag na hora.
 */
export const listCafesAtivos = unstable_cache(
  fetchCafesAtivos,
  ["cafes-ativos", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  { revalidate: 3600, tags: [CAFES_TAG] },
);

async function fetchCafesAtivos(): Promise<Cafe[]> {
  const { data, error } = await createAnonClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .eq("ativo", true)
    .overrideTypes<Cafe[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar cafés: ${error.message}`);
  }
  return data.map(comFotosPublicas).sort(compararPorNome);
}

/** Café ativo pelo slug, ou `null` se não existe ou está inativo (→ 404). */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await createAnonClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle()
    .overrideTypes<Cafe, { merge: false }>();

  if (error) {
    throw new Error(`Falha ao buscar o café "${slug}": ${error.message}`);
  }
  return data && comFotosPublicas(data);
}

/**
 * Admin: todos os cafés, ativos e inativos, em ordem alfabética. Sem cache e
 * com a sessão do cookie — quem decide o que volta é a RLS (`private.is_admin()`);
 * sem sessão de admin, só voltariam os ativos.
 */
export async function listTodosCafes(): Promise<Cafe[]> {
  const { data, error } = await createSessionClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .overrideTypes<Cafe[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar cafés do admin: ${error.message}`);
  }
  return data.map(comFotosPublicas).sort(compararPorNome);
}

/** Admin: café pelo id, ativo ou não; `null` se não existe (→ 404). */
export async function getCafeById(id: string): Promise<Cafe | null> {
  if (!isUuid(id)) return null;

  const { data, error } = await createSessionClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Cafe, { merge: false }>();

  if (error) {
    throw new Error(`Falha ao buscar o café ${id}: ${error.message}`);
  }
  return data && comFotosPublicas(data);
}

/**
 * Admin: já existe linha em `cafe_fotos` com este caminho? Antes de descartar
 * um upload cujo registro não respondeu — se ele gravou, o arquivo fica.
 */
export async function fotoRegistrada(storagePath: string): Promise<boolean> {
  const { count, error } = await createSessionClient()
    .from("cafe_fotos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", storagePath);

  if (error) {
    throw new Error(`Falha ao conferir a foto ${storagePath}: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

/** Foto de um café no admin: URL pública, posição e a autorização registrada. */
/** `temporaria` (#92): no ar como qualquer outra, marcada no admin para trocar depois. */
export type FotoDoCafe = Autorizacao & {
  id: string;
  storage_path: string;
  ordem: number;
  temporaria: boolean;
  url: string;
};

/**
 * Admin: fotos do café em `cafe_fotos`, na ordem do site (o mesmo desempate do
 * trigger que deriva `cafes.fotos`). Só o admin lê a tabela — a RLS decide.
 */
export async function listFotosDoCafe(cafeId: string): Promise<FotoDoCafe[]> {
  if (!isUuid(cafeId)) return [];

  const { data, error } = await createSessionClient()
    .from("cafe_fotos")
    .select("id, storage_path, ordem, temporaria, origem, autorizado_por, autorizado_em, observacao")
    .eq("cafe_id", cafeId)
    .order("ordem")
    .order("criado_em")
    .order("id")
    .overrideTypes<Omit<FotoDoCafe, "url">[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar as fotos do café ${cafeId}: ${error.message}`);
  }
  const urls = urlsPublicasDasFotos(
    data.map((foto) => foto.storage_path),
    supabaseEnv().url,
  );
  return data.map((foto, i) => ({ ...foto, url: urls[i] }));
}

/**
 * Admin: quantas fotos temporárias cada café tem (#92), por id — café sem
 * nenhuma fica de fora. A lista do painel vira a lista do que falta fotografar.
 */
export async function contarFotosTemporarias(): Promise<Record<string, number>> {
  const { data, error } = await createSessionClient()
    .from("cafe_fotos")
    .select("cafe_id")
    .eq("temporaria", true)
    .overrideTypes<{ cafe_id: string }[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao contar as fotos temporárias: ${error.message}`);
  }
  const contagem: Record<string, number> = {};
  for (const { cafe_id } of data) contagem[cafe_id] = (contagem[cafe_id] ?? 0) + 1;
  return contagem;
}

/** Teto da lista de sugestões: sem paginação, um robô com muitos IPs não infla a página. */
export const LIMITE_DE_SUGESTOES = 200;

/**
 * Admin: sugestões com os status pedidos, mais recentes primeiro (#84). Só o
 * admin lê a tabela — a RLS decide; sem sessão de admin, volta vazio.
 */
export async function listSugestoes(status: readonly StatusSugestao[]): Promise<Sugestao[]> {
  const { data, error } = await createSessionClient()
    .from("sugestoes")
    .select("id, tipo, mensagem, origem, status, criado_em")
    .in("status", [...status])
    .order("criado_em", { ascending: false })
    .order("id")
    .limit(LIMITE_DE_SUGESTOES)
    .overrideTypes<Sugestao[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar as sugestões: ${error.message}`);
  }
  return data;
}

/** Admin: quantas sugestões há em cada status — o cartão do `/admin` e os chips da lista. */
export async function contarSugestoes(): Promise<ContagemDeSugestoes> {
  const client = createSessionClient();
  const contagens = await Promise.all(
    STATUS_SUGESTAO.map(async (status) => {
      const { count, error } = await client
        .from("sugestoes")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) {
        throw new Error(`Falha ao contar as sugestões (${status}): ${error.message}`);
      }
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(contagens) as ContagemDeSugestoes;
}

/** Tag do cache das edições públicas — o admin a invalida (`revalidarCafe`). */
export const FESTIVAIS_TAG = "festivais";

const SELECT_EDICAO = `id, ano, inicio, fim, descricao, preco, publicada,
  festival:festivais!inner(slug, nome),
  participacoes:festival_participacoes(id, cafe_id, numero, nome_combo, alt, instagram_url, arte_path)`;

type LinhaEdicao = Omit<Edicao, "participacoes"> & {
  participacoes: (Omit<Participacao, "arte"> & { arte_path: string | null })[];
};

/** `arte_path` guarda o caminho no bucket; quem lê a edição recebe a URL pública. */
function comArtesPublicas({ participacoes, ...edicao }: LinhaEdicao): Edicao {
  const url = supabaseEnv().url;
  return {
    ...edicao,
    participacoes: participacoes.map(({ arte_path, ...p }) => ({
      ...p,
      arte: arte_path && urlPublicaDaArte(arte_path, url),
    })),
  };
}

/**
 * Edições publicadas dos festivais, com os participantes (só cafés no ar — a
 * RLS decide) e as artes em URL pública. Encerradas e futuras vêm junto:
 * "no ar hoje" é decidido no render (`edicoesNoAr`), fora do cache, para o
 * cache nunca atravessar a virada do dia. Mesmo esquema de cache de
 * `listCafesAtivos`, com tag própria.
 */
export const listFestivais = unstable_cache(
  fetchFestivais,
  ["festivais", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  { revalidate: 3600, tags: [FESTIVAIS_TAG] },
);

async function fetchFestivais(): Promise<Edicao[]> {
  const { data, error } = await createAnonClient()
    .from("festival_edicoes")
    .select(SELECT_EDICAO)
    .eq("publicada", true)
    .order("inicio")
    .overrideTypes<LinhaEdicao[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar os festivais: ${error.message}`);
  }
  return data.map(comArtesPublicas);
}

/**
 * Admin: todas as edições, publicadas ou não, as mais novas primeiro, com
 * todos os participantes (inclusive cafés fora do ar). Sem cache, com a sessão
 * do cookie — a RLS decide; sem sessão de admin, só voltariam as publicadas.
 */
export async function listEdicoes(): Promise<Edicao[]> {
  const { data, error } = await createSessionClient()
    .from("festival_edicoes")
    .select(SELECT_EDICAO)
    .order("inicio", { ascending: false })
    .overrideTypes<LinhaEdicao[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar as edições do admin: ${error.message}`);
  }
  return data.map(comArtesPublicas);
}

/** Admin: edição pelo id, publicada ou não; `null` se não existe (→ 404). */
export async function getEdicaoById(id: string): Promise<Edicao | null> {
  if (!isUuid(id)) return null;

  const { data, error } = await createSessionClient()
    .from("festival_edicoes")
    .select(SELECT_EDICAO)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<LinhaEdicao, { merge: false }>();

  if (error) {
    throw new Error(`Falha ao buscar a edição ${id}: ${error.message}`);
  }
  return data && comArtesPublicas(data);
}

/** Arte de um participante no admin (#105): o caminho no bucket e quem autorizou. */
export type ArteDoParticipante = AutorizacaoDaArte & { caminho: string };

/**
 * Admin: as artes da edição por participação — só quem tem arte. O público
 * não lê a autorização (grant por coluna); as actions usam o caminho para
 * apagar o arquivo antigo.
 */
export async function listArtesDaEdicao(edicaoId: string): Promise<Record<string, ArteDoParticipante>> {
  if (!isUuid(edicaoId)) return {};

  const { data, error } = await createSessionClient()
    .from("festival_participacoes")
    .select("id, arte_path, autorizado_por, autorizado_em")
    .eq("edicao_id", edicaoId)
    .not("arte_path", "is", null)
    .overrideTypes<({ id: string; arte_path: string } & AutorizacaoDaArte)[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar as artes da edição ${edicaoId}: ${error.message}`);
  }
  return Object.fromEntries(
    data.map(({ id, arte_path, autorizado_por, autorizado_em }) => [
      id,
      { caminho: arte_path, autorizado_por, autorizado_em },
    ]),
  );
}

/** Admin: o caminho já é a arte de alguma participação? O descarte (#105) não apaga arte no ar. */
export async function arteRegistrada(caminho: string): Promise<boolean> {
  const { count, error } = await createSessionClient()
    .from("festival_participacoes")
    .select("id", { count: "exact", head: true })
    .eq("arte_path", caminho);

  if (error) {
    throw new Error(`Falha ao conferir a arte ${caminho}: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export type FestivalCadastrado = { id: string; slug: FestivalSlug; nome: string };

/** Admin: os dois festivais (entram por migration) — o seletor do cadastro de edição e o `festival_id` do insert. */
export async function listFestivaisCadastrados(): Promise<FestivalCadastrado[]> {
  const { data, error } = await createSessionClient()
    .from("festivais")
    .select("id, slug, nome")
    .order("nome")
    .overrideTypes<FestivalCadastrado[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar os festivais cadastrados: ${error.message}`);
  }
  return data;
}
