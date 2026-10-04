import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `requireAdmin` (#59): a segunda camada do admin. A garantia real é a RLS,
 * mas esta função é quem manda para o login antes de a página renderizar — e
 * precisa barrar quem só tem a senha, quem só editou o próprio `user_metadata`
 * e quem ficou em `aal1`. `getUser()` vai ao servidor de auth de propósito;
 * aqui o client é dublê, para provar a decisão a partir das respostas dele.
 */

// `server-only` lança fora de um Server Component; no teste é um módulo vazio.
vi.mock("server-only", () => ({}));

// `redirect` do Next lança (interrompe a renderização): o dublê faz igual.
const REDIRECT = Symbol("redirect");
const redirect = vi.fn((destino: string) => {
  throw { [REDIRECT]: destino };
});
vi.mock("next/navigation", () => ({ redirect }));

const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createSessionClient: () => ({
    auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } },
  }),
}));

// `cache` do React guarda o resultado por request; aqui cada teste é um request.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: (fn: unknown) => fn }));

const admin = { app_metadata: { role: "admin" }, email: "admin@mapadocafe-pe.com.br" };

async function chamar() {
  const { requireAdmin } = await import("./require-admin");
  try {
    return { ok: true as const, resultado: await requireAdmin() };
  } catch (erro) {
    if (erro && typeof erro === "object" && REDIRECT in erro) return { ok: false as const, destino: erro[REDIRECT] };
    throw erro;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  getUser.mockResolvedValue({ data: { user: admin }, error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" } });
});

describe("requireAdmin", () => {
  it("admin com papel em app_metadata e segundo fator (aal2) passa", async () => {
    const r = await chamar();
    expect(r).toEqual({ ok: true, resultado: { email: "admin@mapadocafe-pe.com.br" } });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sem usuário na sessão vai para o login", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await chamar()).toEqual({ ok: false, destino: "/admin/login" });
  });

  it("erro do servidor de auth (token revogado, usuário apagado) vai para o login", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    expect(await chamar()).toEqual({ ok: false, destino: "/admin/login" });
  });

  it("papel só em user_metadata não vale: vai para o login", async () => {
    getUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "admin" }, app_metadata: {}, email: "x@x" } },
      error: null,
    });
    expect(await chamar()).toEqual({ ok: false, destino: "/admin/login" });
  });

  it("admin só com a senha (aal1), sem o segundo fator, não passa", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1" } });
    expect(await chamar()).toEqual({ ok: false, destino: "/admin/login" });
  });
});
