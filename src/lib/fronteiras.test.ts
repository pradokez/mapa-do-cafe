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
    if (!/\.(ts|tsx|js|mjs)$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return [];
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

  it("café nunca é apagado: sai do ar com `ativo = false` (o banco também não tem política de delete)", () => {
    expect(comCodigo(/\.from\(\s*["'`]cafes["'`]\s*\)[^;]*\.delete\(/)).toEqual([]);
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

describe("fronteira do Mapbox", () => {
  it("só o <CafeMap /> importa mapbox-gl (regra 1): trocar de lib mexe num arquivo só", () => {
    expect(comCodigo(/["']mapbox-gl(\/[^"']*)?["']/)).toEqual(["components/cafe-map.tsx"]);
  });
});

// Guarda de segurança (#59): a checagem de admin mora DENTRO de cada Server
// Action de escrita, não só na página. Uma action que esquecesse o
// `requireAdmin()` — ou o chamasse depois de já ler/gravar — seria chamável por
// `fetch` direto, sem sessão (ver docs/security/pentest-2026-10.md).
describe("toda Server Action de escrita começa com requireAdmin", () => {
  const ACOES_DE_ESCRITA = ["admin/status-actions.ts", "admin/fotos-actions.ts", "admin/cafe-actions.ts"];
  // Qualquer leitura, escrita ou efeito: nada pode vir antes do `requireAdmin()`.
  const EFEITO = /createSessionClient\(|\.from\(|\.storage\b|getCafeById|getCafeBySlug|listFotosDoCafe|listTodosCafes|fotoRegistrada|revalidat/;

  const corpos = (codigo: string): { nome: string; corpo: string }[] => {
    const blocos: { nome: string; corpo: string }[] = [];
    const inicio = /export async function (\w+)/g;
    let atual: RegExpExecArray | null;
    while ((atual = inicio.exec(codigo)) !== null) {
      const proximo = inicio.lastIndex;
      const fim = codigo.indexOf("export async function", proximo);
      blocos.push({ nome: atual[1], corpo: codigo.slice(atual.index, fim === -1 ? undefined : fim) });
    }
    return blocos;
  };

  for (const arquivo of ACOES_DE_ESCRITA) {
    const codigo = readFileSync(join(SRC, "lib", arquivo), "utf8");
    for (const { nome, corpo } of corpos(codigo)) {
      it(`${arquivo} › ${nome}() chama requireAdmin antes de qualquer efeito`, () => {
        const admin = corpo.indexOf("await requireAdmin()");
        const efeito = corpo.search(EFEITO);
        expect(admin, "não chama requireAdmin()").toBeGreaterThanOrEqual(0);
        if (efeito >= 0) expect(admin, "requireAdmin() vem depois de um efeito").toBeLessThan(efeito);
      });
    }
  }
});
