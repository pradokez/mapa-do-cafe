/**
 * Gera supabase/seed.sql a partir de supabase/seed/cafes.json.
 *
 * O JSON entra no SQL como literal, sem passar por transformação: quem
 * converte para colunas é o próprio Postgres (`jsonb_to_recordset`). Assim
 * os registros — inclusive os `id`s — chegam ao banco exatamente como estão
 * no arquivo.
 *
 * O seed só insere (`on conflict (id) do nothing`): a produção é a fonte da
 * verdade, e reaplicá-lo nunca desfaz edição feita pelo admin. O JSON é um
 * retrato dela, trazido por `pnpm seed:pull`.
 *
 * Uso: pnpm seed:build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CAFE_COLUMNS } from "../src/lib/cafe";

const TAG = "$seed$";

// Tipo SQL de cada coluna, para o `jsonb_to_recordset`.
const SQL_TYPES: Record<(typeof CAFE_COLUMNS)[number], string> = {
  id: "uuid",
  slug: "text",
  nome: "text",
  bairro: "text",
  bairro_slug: "text",
  endereco: "text",
  cidade: "text",
  lat: "double precision",
  lng: "double precision",
  selo_ascape: "boolean",
  selo_eu_amo_cafe: "boolean",
  aceita_pets: "boolean",
  tem_estacionamento: "boolean",
  permite_coffee_office: "boolean",
  acessivel_pcd: "boolean",
  opcoes_vegetarianas: "boolean",
  tem_ar_condicionado: "boolean",
  faixa_preco: "text",
  horario_funcionamento: "jsonb",
  instagram: "text",
  telefone: "text",
  fotos: "text[]",
  ativo: "boolean",
};

export function buildSeedSql(cafesJson: string): string {
  if (cafesJson.includes(TAG)) {
    throw new Error(`O JSON do seed não pode conter ${TAG}.`);
  }
  const list = CAFE_COLUMNS.join(",\n  ");
  const recordset = CAFE_COLUMNS.map((name) => `${name} ${SQL_TYPES[name]}`).join(",\n  ");

  return `-- Gerado por scripts/build-seed.ts a partir de supabase/seed/cafes.json.
-- Não edite à mão: o JSON é um retrato da produção (\`pnpm seed:pull\`).
-- Só insere café que falta; café que já existe fica como está.

insert into public.cafes (
  ${list}
)
select
  ${list}
from jsonb_to_recordset(${TAG}${cafesJson}${TAG}::jsonb) as c (
  ${recordset}
)
on conflict (id) do nothing;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL("../supabase/", import.meta.url);
  const json = readFileSync(new URL("seed/cafes.json", root), "utf8");
  writeFileSync(new URL("seed.sql", root), buildSeedSql(json));
  console.log("supabase/seed.sql atualizado.");
}
