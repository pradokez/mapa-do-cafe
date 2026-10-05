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

// Server Actions do admin, achadas por varredura (não por lista fixa): action
// nova em `lib/admin/` entra nas guardas abaixo sem ninguém lembrar.
const ACOES_DO_ADMIN = arquivos
  .filter(({ caminho, codigo }) => caminho.startsWith("lib/admin/") && /^"use server";$/m.test(codigo))
  .flatMap(({ caminho, codigo }) => corpos(codigo).map((acao) => ({ arquivo: caminho, ...acao })));

/** Cada `export async function` do arquivo, com o corpo até a próxima. */
function corpos(codigo: string): { nome: string; corpo: string }[] {
  const blocos: { nome: string; corpo: string }[] = [];
  const inicio = /export async function (\w+)/g;
  let atual: RegExpExecArray | null;
  while ((atual = inicio.exec(codigo)) !== null) {
    const fim = codigo.indexOf("export async function", inicio.lastIndex);
    blocos.push({ nome: atual[1], corpo: codigo.slice(atual.index, fim === -1 ? undefined : fim) });
  }
  return blocos;
}

// Qualquer leitura, escrita ou efeito.
const EFEITO = /createSessionClient\(|\.from\(|\.storage\b|getCafeById|getCafeBySlug|listFotosDoCafe|listTodosCafes|fotoRegistrada|revalidat/;

// Guarda de segurança (#59): a checagem de admin mora DENTRO de cada Server
// Action de escrita, não só na página. Uma action que esquecesse o
// `requireAdmin()` — ou o chamasse depois de já ler/gravar — seria chamável por
// `fetch` direto, sem sessão (ver docs/security/pentest-2026-10.md). As de
// `auth-actions.ts` (login, código, sair) são a porta de entrada: ficam de fora.
describe("toda Server Action do admin começa com requireAdmin", () => {
  for (const { arquivo, nome, corpo } of ACOES_DO_ADMIN.filter((a) => a.arquivo !== "lib/admin/auth-actions.ts")) {
    it(`${arquivo} › ${nome}() chama requireAdmin antes de qualquer efeito`, () => {
      const admin = corpo.indexOf("await requireAdmin()");
      const efeito = corpo.search(EFEITO);
      expect(admin, "não chama requireAdmin()").toBeGreaterThanOrEqual(0);
      if (efeito >= 0) expect(admin, "requireAdmin() vem depois de um efeito").toBeLessThan(efeito);
    });
  }
});

// Cinto de segurança (#75): fora da produção da Vercel, o dev aponta para o
// banco de produção. Toda action que grava (tabela ou Storage) checa o modo
// leitura logo depois do `requireAdmin()`, antes de qualquer efeito.
describe("toda Server Action que grava respeita o modo leitura", () => {
  const ESCRITA = /\.from\(|\.storage\b|\.insert\(|\.update\(|\.delete\(|\.remove\(/;
  const QUE_GRAVAM = ACOES_DO_ADMIN.filter(({ corpo }) => ESCRITA.test(corpo));

  it("a varredura acha as actions que gravam (e não as que só leem ou autenticam)", () => {
    const nomes = QUE_GRAVAM.map(({ nome }) => nome);
    expect(nomes).toEqual(
      expect.arrayContaining([
        "salvarDadosCafe",
        "cadastrarCafe",
        "definirStatus",
        "prepararUpload",
        "registrarFoto",
        "descartarUpload",
        "reordenarFoto",
        "removerFoto",
      ]),
    );
    expect(nomes).not.toContain("coordenadasDoLink");
    expect(nomes).not.toContain("entrar");
    expect(nomes).not.toContain("sair");
  });

  for (const { arquivo, nome, corpo } of QUE_GRAVAM) {
    it(`${arquivo} › ${nome}() checa o modo leitura depois do requireAdmin e antes de qualquer efeito`, () => {
      const admin = corpo.indexOf("await requireAdmin()");
      const bloqueio = corpo.indexOf("bloqueioDeEscrita()");
      const efeito = corpo.search(EFEITO);
      expect(bloqueio, "não chama bloqueioDeEscrita()").toBeGreaterThanOrEqual(0);
      expect(bloqueio, "bloqueioDeEscrita() vem antes do requireAdmin()").toBeGreaterThan(admin);
      expect(bloqueio, "bloqueioDeEscrita() vem depois de um efeito").toBeLessThan(efeito);
    });
  }
});
