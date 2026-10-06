import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Triagem de sugestões (#84): a action muda só o status, de uma sugestão por
 * id válido, e nada chega ao banco com entrada inválida ou em modo leitura.
 * Supabase, sessão e cache são dublês.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sessao = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const update = vi.fn();
const eq = vi.fn();
const from = vi.fn(() => ({ update }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: () => ({ from }) }));

import { mudarStatusSugestao } from "./sugestoes-actions";

const ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

function form(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [k, v] of Object.entries(campos)) dados.set(k, v);
  return dados;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  sessao.requireAdmin.mockResolvedValue({ email: "admin@x" });
  update.mockReturnValue({ eq });
  eq.mockResolvedValue({ error: null, count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mudarStatusSugestao", () => {
  it("grava só o status, na sugestão do id", async () => {
    const resultado = await mudarStatusSugestao(null, form({ id: ID, status: "arquivada", mensagem: "<b>trocada</b>" }));

    expect(resultado).toEqual({ ok: true, id: ID, status: "arquivada" });
    expect(from).toHaveBeenCalledWith("sugestoes");
    expect(update).toHaveBeenCalledWith({ status: "arquivada" }, { count: "exact" });
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it.each([
    ["id malformado", { id: "1 or 1=1", status: "lida" }],
    ["sem id", { status: "lida" }],
    ["status desconhecido", { id: ID, status: "apagada" }],
    ["sem status", { id: ID }],
  ])("%s não chega ao banco", async (_caso, campos) => {
    const resultado = await mudarStatusSugestao(null, form(campos));

    expect(resultado).toMatchObject({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("update que não muda linha nenhuma (barrado pela RLS, id inexistente) é erro, não sucesso", async () => {
    eq.mockResolvedValue({ error: null, count: 0 });

    expect(await mudarStatusSugestao(null, form({ id: ID, status: "lida" }))).toMatchObject({ ok: false });
  });

  it("erro do banco é erro", async () => {
    eq.mockResolvedValue({ error: { code: "42501", message: "permission denied" }, count: null });

    expect(await mudarStatusSugestao(null, form({ id: ID, status: "lida" }))).toMatchObject({ ok: false });
  });

  it("fora da produção, sem a liberação, o modo leitura recusa antes do banco", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");

    const resultado = await mudarStatusSugestao(null, form({ id: ID, status: "lida" }));

    expect(resultado).toMatchObject({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });
});
