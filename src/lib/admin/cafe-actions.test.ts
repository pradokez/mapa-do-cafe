import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cafe } from "@/lib/cafe";
import { cafe } from "@/lib/cafe.fixture";

/**
 * Edição dos dados de um café (#48), com o endereço editável (#155): o que
 * chega ao banco e o que é revalidado. Supabase, sessão, repositório e cache
 * são dublês — a RLS e o `unique` do slug reais são conferidos à mão.
 */

vi.mock("server-only", () => ({}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cache);

const sessao = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const repo = vi.hoisted(() => ({ getCafeById: vi.fn(), CAFES_TAG: "cafes", FESTIVAIS_TAG: "festivais" }));
vi.mock("@/lib/cafe-repository", () => repo);

const banco = vi.hoisted(() => {
  const resposta = { atual: { error: null as { code: string; message: string } | null } };
  const eq = vi.fn(() => Promise.resolve(resposta.atual));
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => Promise.resolve(resposta.atual));
  const from = vi.fn(() => ({ update, insert }));
  return { resposta, eq, update, insert, from };
});
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: () => ({ from: banco.from }) }));

const revisoes = vi.hoisted(() => ({ marcarRevisaoAprovada: vi.fn() }));
vi.mock("./revisoes", () => revisoes);

import { cadastrarCafe, salvarDadosCafe } from "./cafe-actions";

const ID = "0b4a1f6e-2f61-4d7c-9a31-0c8f3f1f0a11";
const ANTES = cafe(ID, { slug: "cafe-antigo", nome: "Café Antigo" });

/** O payload: o café inteiro, com chaves que a action nunca grava (`id`, `fotos`, `ativo`). */
const campos = (mudancas: Partial<Cafe> = {}) => ({ ...ANTES, ...mudancas });

/** Depois do `update`, o repositório devolve o café como o banco guardou. */
function guardado(mudancas: Partial<Cafe>) {
  repo.getCafeById.mockResolvedValueOnce(ANTES).mockResolvedValueOnce({ ...ANTES, ...mudancas });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  sessao.requireAdmin.mockResolvedValue({ email: "admin@x" });
  banco.resposta.atual = { error: null };
  repo.getCafeById.mockResolvedValue(ANTES);
  revisoes.marcarRevisaoAprovada.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("salvarDadosCafe — endereço", () => {
  it("grava o slug validado junto com os dados", async () => {
    guardado({ slug: "cafe-novo", nome: "Café Novo" });

    const resultado = await salvarDadosCafe(ID, campos({ slug: "  cafe-novo ", nome: "Café Novo" }));

    expect(resultado).toMatchObject({ ok: true, cafe: { slug: "cafe-novo" } });
    expect(banco.update).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-novo", nome: "Café Novo" }));
    expect(banco.eq).toHaveBeenCalledWith("id", ID);
    const [gravado] = banco.update.mock.calls[0] as unknown as [object];
    for (const chave of ["id", "fotos", "ativo"]) expect(gravado).not.toHaveProperty(chave);
  });

  it.each([
    ["vazio", ""],
    ["fora do formato", "Café Novo"],
    ["de um redirect antigo", "borsoi-cafe"],
  ])("slug %s nunca chega ao banco e volta como erro do campo", async (_caso, slug) => {
    const resultado = await salvarDadosCafe(ID, campos({ slug }));

    expect(resultado).toMatchObject({ ok: false, erros: { slug: expect.any(String) } });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("slug de outro café (23505) volta como erro do campo, sem revalidar", async () => {
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" } };

    const resultado = await salvarDadosCafe(ID, campos({ slug: "outro-cafe" }));

    expect(resultado).toEqual({
      ok: false,
      erro: null,
      erros: { slug: "Já existe um café em /cafes/outro-cafe. Escolha outro endereço." },
    });
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("revalida o endereço antigo e o novo, e as leituras do site", async () => {
    guardado({ slug: "cafe-novo" });

    await salvarDadosCafe(ID, campos({ slug: "cafe-novo" }));

    const caminhos = cache.revalidatePath.mock.calls.map(([caminho]) => caminho);
    expect(caminhos).toEqual(expect.arrayContaining(["/cafes/cafe-antigo", "/cafes/cafe-novo"]));
    expect(cache.revalidateTag).toHaveBeenCalledWith("cafes");
    expect(cache.revalidateTag).toHaveBeenCalledWith("festivais");
  });

  it("sem troca de endereço, revalida só o atual", async () => {
    guardado({ nome: "Outro Nome" });

    await salvarDadosCafe(ID, campos({ nome: "Outro Nome" }));

    const caminhos = cache.revalidatePath.mock.calls.map(([caminho]) => caminho).filter((c) => c.startsWith("/cafes/"));
    expect(caminhos).toEqual(["/cafes/cafe-antigo"]);
  });

  it("fora da produção, sem a liberação, o modo leitura recusa antes do banco", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");

    expect(await salvarDadosCafe(ID, campos({ slug: "cafe-novo" }))).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });
});

describe("salvarDadosCafe — a partir de uma revisão (#186)", () => {
  const REVISAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

  it("sem revisão, não mexe em revisões", async () => {
    expect(await salvarDadosCafe(ID, campos())).toMatchObject({ ok: true });
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });

  it("com revisão, salvar marca aprovada só a atualização pendente deste café", async () => {
    expect(await salvarDadosCafe(ID, campos(), REVISAO)).toMatchObject({ ok: true });
    expect(revisoes.marcarRevisaoAprovada).toHaveBeenCalledWith(REVISAO, "atualizacao", ID);
  });

  it("revisão que não marca (outro café, já decidida) não desfaz o salvamento", async () => {
    revisoes.marcarRevisaoAprovada.mockResolvedValue(false);
    expect(await salvarDadosCafe(ID, campos(), REVISAO)).toMatchObject({ ok: true });
  });

  it("id de revisão malformado é ignorado", async () => {
    expect(await salvarDadosCafe(ID, campos(), "nao-e-uuid")).toMatchObject({ ok: true });
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });

  it("modo leitura, dados inválidos e erro do banco não marcam", async () => {
    expect(await salvarDadosCafe(ID, campos({ nome: "" }), REVISAO)).toMatchObject({ ok: false });
    banco.resposta.atual = { error: { code: "XX000", message: "falhou" } };
    expect(await salvarDadosCafe(ID, campos(), REVISAO)).toMatchObject({ ok: false });
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
    expect(await salvarDadosCafe(ID, campos(), REVISAO)).toMatchObject({ ok: false });
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });
});

describe("cadastrarCafe — a partir de uma revisão (#187)", () => {
  const REVISAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
  const novo = () => ({ ...ANTES, slug: "cafe-novo", nome: "Café Novo" });

  it("sem revisão, cadastra fora do ar e não mexe em revisões", async () => {
    const resultado = await cadastrarCafe(novo());

    expect(resultado).toEqual({ ok: true, id: expect.any(String) });
    expect(banco.insert).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-novo", ativo: false }));
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });

  it("com revisão, o café nasce fora do ar e marca aprovada só a pendente de café novo", async () => {
    const resultado = await cadastrarCafe(novo(), REVISAO);

    expect(resultado).toEqual({ ok: true, id: expect.any(String) });
    expect(banco.insert).toHaveBeenCalledWith(expect.objectContaining({ ativo: false }));
    expect(revisoes.marcarRevisaoAprovada).toHaveBeenCalledWith(REVISAO, "cafe_novo", null);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("revisão que não marca (já decidida em outra aba) não desfaz o café", async () => {
    revisoes.marcarRevisaoAprovada.mockResolvedValue(false);

    expect(await cadastrarCafe(novo(), REVISAO)).toEqual({ ok: true, id: expect.any(String) });
  });

  it("id de revisão malformado é ignorado", async () => {
    expect(await cadastrarCafe(novo(), "nao-e-uuid")).toMatchObject({ ok: true });
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });

  it("cadastro que falha (slug repetido, inválido) não marca a revisão", async () => {
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" } };
    expect(await cadastrarCafe(novo(), REVISAO)).toMatchObject({ ok: false, erros: { slug: expect.any(String) } });

    expect(await cadastrarCafe({ ...novo(), slug: "" }, REVISAO)).toMatchObject({ ok: false });
    expect(revisoes.marcarRevisaoAprovada).not.toHaveBeenCalled();
  });
});
