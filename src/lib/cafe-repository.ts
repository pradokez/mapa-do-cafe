/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { createClient } from "@supabase/supabase-js";

import { CAFE_COLUMNS, compararPorNome, type Cafe } from "./cafe";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
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
