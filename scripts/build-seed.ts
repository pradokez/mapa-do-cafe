/**
 * Gera supabase/seed.sql a partir de supabase/seed/cafes.json.
 *
 * O JSON entra no SQL como literal, sem passar por transformação: quem
 * converte para colunas é o próprio Postgres (`jsonb_to_recordset`). Assim
 * os registros — inclusive os `id`s — chegam ao banco exatamente como estão
 * no arquivo. Rodar o seed de novo atualiza os registros (upsert por `id`).
 *
 * Uso: pnpm seed:build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TAG = "$seed$";

const COLUMNS = [
  ["id", "uuid"],
  ["slug", "text"],
  ["nome", "text"],
  ["bairro", "text"],
  ["bairro_slug", "text"],
  ["endereco", "text"],
  ["cidade", "text"],
  ["lat", "double precision"],
  ["lng", "double precision"],
  ["selo_ascape", "boolean"],
  ["aceita_pets", "boolean"],
  ["tem_estacionamento", "boolean"],
  ["permite_coffee_office", "boolean"],
  ["faixa_preco", "text"],
  ["comodidades", "text[]"],
  ["horario_funcionamento", "jsonb"],
  ["instagram", "text"],
  ["telefone", "text"],
  ["fotos", "text[]"],
  ["ativo", "boolean"],
] as const;

export function buildSeedSql(cafesJson: string): string {
  if (cafesJson.includes(TAG)) {
    throw new Error(`O JSON do seed não pode conter ${TAG}.`);
  }
  const names = COLUMNS.map(([name]) => name);
  const list = names.join(",\n  ");
  const recordset = COLUMNS.map(([name, type]) => `${name} ${type}`).join(",\n  ");
  const updates = names
    .filter((name) => name !== "id")
    .map((name) => `${name} = excluded.${name}`)
    .join(",\n  ");

  return `-- Gerado por scripts/build-seed.ts a partir de supabase/seed/cafes.json.
-- Não edite à mão: altere o JSON e rode \`pnpm seed:build\`.

insert into public.cafes (
  ${list}
)
select
  ${list}
from jsonb_to_recordset(${TAG}${cafesJson}${TAG}::jsonb) as c (
  ${recordset}
)
on conflict (id) do update set
  ${updates},
  atualizado_em = now();
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL("../supabase/", import.meta.url);
  const json = readFileSync(new URL("seed/cafes.json", root), "utf8");
  writeFileSync(new URL("seed.sql", root), buildSeedSql(json));
  console.log("supabase/seed.sql atualizado.");
}
