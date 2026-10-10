/**
 * Reescreve supabase/seed/cafes.json (e o seed.sql) com os cafés da produção.
 *
 * A produção é a fonte da verdade — café novo e edição se fazem pelo admin —
 * e o JSON é um retrato dela, para os testes do seed olharem o dado real e o
 * repositório acompanhar. Lê pelo `supabase db query --linked` (token do CLI,
 * o mesmo das migrations): nenhuma chave nova no repositório nem no app.
 * Só lê; nada é gravado no banco.
 *
 * Uso: pnpm seed:pull
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CAFE_COLUMNS } from "../src/lib/cafe";
import { DIAS_DA_SEMANA } from "../src/lib/cafe-hours";
import { buildSeedSql } from "./build-seed";

/**
 * Linhas do `db query -o json` → texto do cafes.json. Determinístico (ordem
 * por slug, colunas na ordem de CAFE_COLUMNS, dias de segunda a domingo):
 * dois pulls sem mudança na produção dão o mesmo arquivo.
 */
export function retratoDosCafes(linhas: unknown): string {
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw new Error("A produção não devolveu uma lista de cafés; o arquivo não foi alterado.");
  }

  const cafes = linhas.map((linha: Record<string, unknown>) => {
    const faltando = CAFE_COLUMNS.filter((coluna) => !(coluna in linha));
    if (faltando.length > 0) {
      throw new Error(`Café ${String(linha.slug)} veio sem ${faltando.join(", ")}.`);
    }
    const cafe: Record<string, unknown> = Object.fromEntries(CAFE_COLUMNS.map((coluna) => [coluna, linha[coluna]]));
    // O jsonb devolve as chaves em ordem alfabética; o arquivo segue a semana.
    const horario = cafe.horario_funcionamento as Record<string, unknown>;
    const dias = [...DIAS_DA_SEMANA.filter((dia) => dia in horario), ...Object.keys(horario).filter((dia) => !DIAS_DA_SEMANA.includes(dia as never))];
    cafe.horario_funcionamento = Object.fromEntries(dias.map((dia) => [dia, horario[dia]]));
    // O arquivo da foto só existe no bucket da produção, e o trigger ignora o valor.
    cafe.fotos = [];
    return cafe;
  });

  cafes.sort((a, b) => (String(a.slug) < String(b.slug) ? -1 : String(a.slug) > String(b.slug) ? 1 : 0));
  return `${JSON.stringify(cafes, null, 2)}\n`;
}

function lerDaProducao(): unknown {
  const sql = `select ${CAFE_COLUMNS.join(", ")} from public.cafes`;
  try {
    const saida = execFileSync("npx", ["supabase", "db", "query", "--linked", "--agent", "no", "-o", "json", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    return JSON.parse(saida);
  } catch (erro) {
    throw new Error(
      "Não deu para ler a produção. O diretório precisa estar linkado (`npx supabase link`; numa worktree, " +
        "copie supabase/.temp do checkout principal) e o CLI logado (`npx supabase login`).",
      { cause: erro },
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL("../supabase/", import.meta.url);
  const json = retratoDosCafes(lerDaProducao());
  writeFileSync(new URL("seed/cafes.json", root), json);
  writeFileSync(new URL("seed.sql", root), buildSeedSql(json));
  const cafes: { ativo: boolean }[] = JSON.parse(json);
  console.log(
    `supabase/seed/cafes.json e seed.sql atualizados: ${cafes.length} cafés, ${cafes.filter((c) => c.ativo).length} no ar.`,
  );
}
