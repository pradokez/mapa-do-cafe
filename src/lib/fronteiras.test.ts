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

// Sugestões (#83): a primeira escrita pública. Exceção nomeada e estreita —
// um arquivo, uma função do banco, nenhuma tabela.
describe("fronteira da escrita pública (sugestões)", () => {
  const ACAO_PUBLICA = "lib/sugestoes-actions.ts";

  it("só a action de sugestões chama função do banco, e só a `enviar_sugestao`", () => {
    expect(comCodigo(/\.rpc\(/)).toEqual([ACAO_PUBLICA]);
    const { codigo } = arquivos.find(({ caminho }) => caminho === ACAO_PUBLICA)!;
    const chamadas = codigo.match(/\.rpc\(\s*["'`][^"'`]*["'`]/g);
    expect(chamadas).toEqual(['.rpc("enviar_sugestao"']);
  });

  it("o client anônimo (sem sessão) é só do repositório e da action de sugestões", () => {
    const usam = comCodigo(/createAnonClient\(/).filter((caminho) => caminho !== "lib/supabase-server.ts");
    expect(usam.sort()).toEqual(["lib/cafe-repository.ts", ACAO_PUBLICA]);
  });

  it("o segredo do hash de IP nunca vai para o navegador e está documentado no .env.example", () => {
    expect(comCodigo(/NEXT_PUBLIC_SUGESTOES/)).toEqual([]);
    expect(readFileSync(join(SRC, "..", ".env.example"), "utf8")).toMatch(/^SUGESTOES_IP_SECRET=$/m);
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

// A checagem de admin: `requireAdmin()`, ou `sessaoDeAdmin()` (#74), que não
// redireciona — esta vale só com o retorno checado na mesma linha.
const GUARDA = /await requireAdmin\(\)|if \(!\(await sessaoDeAdmin\(\)\)\)/;

// Qualquer leitura, escrita ou efeito.
const EFEITO = /createSessionClient\(|\.from\(|\.storage\b|getCafeById|getCafeBySlug|listFotosDoCafe|listTodosCafes|fotoRegistrada|listEdicoes|getEdicaoById|revalidat/;

// Guarda de segurança (#59): a checagem de admin mora DENTRO de cada Server
// Action de escrita, não só na página. Uma action que esquecesse o
// `requireAdmin()` — ou o chamasse depois de já ler/gravar — seria chamável por
// `fetch` direto, sem sessão (ver docs/security/pentest-2026-10.md). As de
// `auth-actions.ts` (login, código, sair) são a porta de entrada: ficam de fora.
// As de foto (#74) usam `sessaoDeAdmin()` (ver `GUARDA`).
describe("toda Server Action do admin começa com requireAdmin", () => {
  for (const { arquivo, nome, corpo } of ACOES_DO_ADMIN.filter((a) => a.arquivo !== "lib/admin/auth-actions.ts")) {
    it(`${arquivo} › ${nome}() chama requireAdmin antes de qualquer efeito`, () => {
      const admin = corpo.search(GUARDA);
      const efeito = corpo.search(EFEITO);
      expect(admin, "não chama requireAdmin()").toBeGreaterThanOrEqual(0);
      if (efeito >= 0) expect(admin, "requireAdmin() vem depois de um efeito").toBeLessThan(efeito);
    });
  }
});

// Server Action fora do formato `export async function` escaparia das guardas
// (o `corpos` não a enxerga): nos arquivos `"use server"` do admin, só esse.
it("Server Actions do admin são `export async function` (as guardas abaixo leem só esse formato)", () => {
  const foraDoFormato = arquivos
    .filter(({ caminho, codigo }) => caminho.startsWith("lib/admin/") && /^"use server";$/m.test(codigo))
    .filter(({ codigo }) => /^export (const|let|var|default|function)\b/m.test(codigo))
    .map(({ caminho }) => caminho);
  expect(foraDoFormato).toEqual([]);
});

// Cinto de segurança (#75): fora da produção da Vercel, o dev aponta para o
// banco de produção. Toda action do admin (menos as da auth) checa o modo
// leitura logo depois da checagem de admin (`GUARDA`), antes de qualquer efeito — exceto
// as declaradas só de leitura. Opt-out explícito, não opt-in: uma action nova
// que gravasse por um helper escaparia de uma busca por `.insert`/`.update`.
describe("toda Server Action do admin respeita o modo leitura", () => {
  const SO_LEITURA = ["coordenadasDoLink"];
  const ESCRITA = /\.from\(|\.storage\b|\.insert\(|\.update\(|\.delete\(|\.remove\(|revalidat/;
  const DO_DIRETORIO = ACOES_DO_ADMIN.filter((a) => a.arquivo !== "lib/admin/auth-actions.ts");

  for (const nome of SO_LEITURA) {
    it(`${nome}() existe e não grava nada (senão sai da lista de só leitura)`, () => {
      const acao = DO_DIRETORIO.find((a) => a.nome === nome);
      expect(acao, "action não encontrada").toBeDefined();
      expect(acao?.corpo).not.toMatch(ESCRITA);
    });
  }

  for (const { arquivo, nome, corpo } of DO_DIRETORIO.filter((a) => !SO_LEITURA.includes(a.nome))) {
    it(`${arquivo} › ${nome}() checa o modo leitura depois da checagem de admin e antes de qualquer efeito`, () => {
      const admin = corpo.search(GUARDA);
      const bloqueio = corpo.indexOf("bloqueioDeEscrita()");
      const efeito = corpo.search(EFEITO);
      expect(bloqueio, "não chama bloqueioDeEscrita()").toBeGreaterThanOrEqual(0);
      expect(admin, "não checa a sessão de admin").toBeGreaterThanOrEqual(0);
      expect(bloqueio, "bloqueioDeEscrita() vem antes da checagem de admin").toBeGreaterThan(admin);
      if (efeito >= 0) expect(bloqueio, "bloqueioDeEscrita() vem depois de um efeito").toBeLessThan(efeito);
    });
  }
});
