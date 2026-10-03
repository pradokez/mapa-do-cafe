/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { isUuid } from "./admin-auth";
import { CAFE_COLUMNS, compararPorNome, type Cafe } from "./cafe";
import { createSessionClient } from "./supabase-server";
import { supabaseEnv } from "./supabase-env";

/** Leitura pública: sem sessão, só o que a RLS mostra a `anon` (cafés ativos). */
function publicClient() {
  const { url, key } = supabaseEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}

const SELECT_CAFE = CAFE_COLUMNS.join(", ");

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
  const { data, error } = await publicClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .eq("ativo", true)
    .overrideTypes<Cafe[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar cafés: ${error.message}`);
  }
  return data.sort(compararPorNome);
}

/** Café ativo pelo slug, ou `null` se não existe ou está inativo (→ 404). */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await publicClient()
    .from("cafes")
    .select(SELECT_CAFE)
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle()
    .overrideTypes<Cafe, { merge: false }>();

  if (error) {
    throw new Error(`Falha ao buscar o café "${slug}": ${error.message}`);
  }
  return data;
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
  return data.sort(compararPorNome);
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
  return data;
}
