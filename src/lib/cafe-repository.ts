/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { createClient } from "@supabase/supabase-js";

import { CAFE_COLUMNS, compararPorNome, type Cafe } from "./cafe";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Cafés ativos em ordem alfabética (pt-BR, ignorando acento e caixa). */
export async function listCafesAtivos(): Promise<Cafe[]> {
  const { data, error } = await client()
    .from("cafes")
    .select(CAFE_COLUMNS.join(", "))
    .eq("ativo", true)
    .overrideTypes<Cafe[], { merge: false }>();

  if (error) {
    throw new Error(`Falha ao listar cafés: ${error.message}`);
  }
  return data.sort(compararPorNome);
}

/** Café ativo pelo slug, ou `null` se não existe ou está inativo (→ 404). */
export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const { data, error } = await client()
    .from("cafes")
    .select(CAFE_COLUMNS.join(", "))
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle()
    .overrideTypes<Cafe, { merge: false }>();

  if (error) {
    throw new Error(`Falha ao buscar o café "${slug}": ${error.message}`);
  }
  return data;
}
