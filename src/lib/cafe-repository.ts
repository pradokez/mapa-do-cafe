/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { unstable_cache } from "next/cache";

import { isUuid } from "./admin-auth";
import { CAFE_COLUMNS, compararPorNome, type Cafe } from "./cafe";
import { urlsPublicasDasFotos } from "./cafe-photos";
import type { Autorizacao } from "./foto-upload";
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
