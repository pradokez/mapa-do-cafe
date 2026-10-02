/**
 * Única porta de leitura do Supabase (regra inviolável 2 do CLAUDE.md).
 * Nenhum outro arquivo importa o client do Supabase para ler.
 */
import { createClient } from "@supabase/supabase-js";

import type { Cafe } from "./cafe";

// Colunas do tipo `Cafe` — `location` e timestamps ficam no banco.
const CAFE_COLUMNS = [
  "id",
  "slug",
  "nome",
  "bairro",
  "bairro_slug",
  "endereco",
  "cidade",
  "lat",
  "lng",
  "selo_ascape",
  "aceita_pets",
  "tem_estacionamento",
  "permite_coffee_office",
  "faixa_preco",
  "comodidades",
  "horario_funcionamento",
  "instagram",
  "telefone",
  "fotos",
  "ativo",
].join(", ");

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja .env.example).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Cafés ativos em ordem alfabética (pt-BR, ignorando acento e caixa). */
export async function listCafesAtivos(): Promise<Cafe[]> {
  const { data, error } = await client()
    .from("cafes")
    .select(CAFE_COLUMNS)
    .eq("ativo", true)
    .returns<Cafe[]>();

  if (error) {
    throw new Error(`Falha ao listar cafés: ${error.message}`);
  }
  return data.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}
