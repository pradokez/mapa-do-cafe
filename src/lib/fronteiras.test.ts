import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda das regras do CLAUDE.md que nenhum tipo garante: quem pode falar com
// o Supabase, e que nenhuma chave dele vai para o navegador.

const SRC = join(__dirname, "..");

function arquivosDoApp(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosDoApp(caminho);
    if (!/\.(ts|tsx)$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return [];
    return [relative(SRC, caminho)];
  });
}

const arquivos = arquivosDoApp().map((caminho) => ({
  caminho,
  codigo: readFileSync(join(SRC, caminho), "utf8"),
}));

const comCodigo = (padrao: RegExp) =>
  arquivos.filter(({ codigo }) => padrao.test(codigo)).map(({ caminho }) => caminho);

describe("fronteiras do Supabase", () => {
  it("só o cafe-repository lê tabelas (regra 2); fora dele, `.from(…)` só para escrever, no admin", () => {
    const usamFrom = comCodigo(/\.from\(\s*["'`]/).filter((caminho) => caminho !== "lib/cafe-repository.ts");

    expect(usamFrom.filter((caminho) => !caminho.startsWith("lib/admin/"))).toEqual([]);
    // Escrita sem `.select(…)`: o que precisa ser lido de volta passa pelo repositório.
    expect(comCodigo(/\.select\(/).filter((caminho) => caminho !== "lib/cafe-repository.ts")).toEqual([]);
  });

  it("só o repositório, o módulo de sessão, o admin e o middleware importam o Supabase", () => {
    const permitido = (caminho: string) =>
      [
        "lib/cafe-repository.ts",
        "lib/supabase-server.ts",
        "lib/supabase-env.ts",
        "middleware.ts",
      ].includes(caminho) || caminho.startsWith("lib/admin/");

    expect(comCodigo(/from ["']@supabase\//).filter((caminho) => !permitido(caminho))).toEqual([]);
  });

  it("nenhuma chave do Supabase vai para o bundle do navegador", () => {
    expect(comCodigo(/NEXT_PUBLIC_SUPABASE/)).toEqual([]);
  });

  it("a secret key (que ignora a RLS) não é usada pelo app", () => {
    expect(comCodigo(/SUPABASE_SECRET_KEY|SERVICE_ROLE/)).toEqual([]);
  });

  it("todo arquivo de servidor do admin importa server-only (ou é Server Action)", () => {
    const semGuarda = arquivos
      .filter(({ caminho }) => caminho.startsWith("lib/admin/") || caminho === "lib/supabase-server.ts")
      .filter(({ codigo }) => !/^import "server-only";$/m.test(codigo) && !/^"use server";$/m.test(codigo))
      .map(({ caminho }) => caminho);

    expect(semGuarda).toEqual([]);
  });
});
