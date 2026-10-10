import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Upload de foto (#74): as actions devolvem a falha com etapa e causa — não uma
 * frase genérica — e a registram no log sem segredo. Supabase, sessão e cache
 * são dublês; o que se prova é a decisão a partir das respostas deles.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidar", () => ({ revalidarCafe: vi.fn() }));

const sessao = vi.hoisted(() => ({ sessaoDeAdmin: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const CAMINHO = `${CAFE}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;
const URL_ASSINADA = `https://xyz.supabase.co/storage/v1/object/upload/sign/cafe-fotos/${CAMINHO}?token=eyJsegredo`;

const repo = vi.hoisted(() => ({ getCafeById: vi.fn(), fotoRegistrada: vi.fn(), listFotosDoCafe: vi.fn() }));
vi.mock("@/lib/cafe-repository", () => repo);

const storage = {
  createSignedUploadUrl: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
};
const insert = vi.fn();
/** `update(...).eq(...).eq(...)`: o resultado sai do último `eq`. */
const resultadoUpdate = vi.fn();
const update = vi.fn(() => ({ eq: () => ({ eq: resultadoUpdate }) }));
vi.mock("@/lib/supabase-server", () => ({
  createSessionClient: () => ({
    storage: { from: () => storage },
    from: () => ({ insert, update }),
  }),
}));

import { marcarTemporaria, prepararUpload, registrarFoto } from "./fotos-actions";

const AUTORIZACAO = { origem: "cedida", autorizado_por: "Ana", autorizado_em: "2026-01-02", observacao: "" };
const FOTO = "0b6f3a52-7d1e-4c8a-9f2b-5e4d3c2b1a09";
const WEBP = { type: "image/webp", size: 1000 };

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // O Vitest roda fora da produção da Vercel: sem isto, o modo leitura (#75) barraria tudo.
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  sessao.sessaoDeAdmin.mockResolvedValue({ email: "admin@x" });
  repo.getCafeById.mockResolvedValue({ id: CAFE, slug: "cafe" });
  storage.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: URL_ASSINADA }, error: null });
  storage.exists.mockResolvedValue({ data: true, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  insert.mockResolvedValue({ error: null });
  resultadoUpdate.mockResolvedValue({ error: null, count: 1 });
  repo.listFotosDoCafe.mockResolvedValue([{ id: FOTO, storage_path: CAMINHO, ordem: 0 }]);
});

afterEach(() => {
  log.mockRestore();
  vi.unstubAllEnvs();
});

/** Tudo o que foi para o log, como texto — para provar que nenhum segredo vazou. */
const textoDoLog = () => JSON.stringify(log.mock.calls);

describe("prepararUpload", () => {
  it("sessão expirada: devolve a falha de sessão, sem redirecionar nem tocar no Storage", async () => {
    sessao.sessaoDeAdmin.mockResolvedValue(null);
    expect(await prepararUpload(CAFE, AUTORIZACAO, WEBP)).toEqual({
      ok: false,
      falha: { etapa: "preparar", codigo: "sessao" },
    });
    expect(sessao.requireAdmin).not.toHaveBeenCalled();
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("bucket inexistente: falha com a causa e o log com etapa e café", async () => {
    storage.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { name: "StorageApiError", message: "Bucket not found", status: 400, statusCode: "404" },
    });
    const r = await prepararUpload(CAFE, AUTORIZACAO, WEBP);
    expect(r).toMatchObject({ ok: false, falha: { etapa: "preparar", codigo: "bucket", status: 400 } });
    expect(textoDoLog()).toContain("preparar");
    expect(textoDoLog()).toContain(CAFE);
  });
});

describe("modo leitura (#75)", () => {
  beforeEach(() => vi.stubEnv("ADMIN_ESCRITA_LIBERADA", ""));

  it("prepararUpload recusa com a falha modo-leitura, sem pedir URL ao Storage", async () => {
    expect(await prepararUpload(CAFE, AUTORIZACAO, WEBP)).toEqual({
      ok: false,
      falha: { etapa: "preparar", codigo: "modo-leitura" },
    });
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("registrarFoto recusa sem gravar a linha nem mexer no arquivo", async () => {
    expect(await registrarFoto(CAFE, CAMINHO, AUTORIZACAO)).toEqual({
      ok: false,
      falha: { etapa: "registrar", codigo: "modo-leitura" },
    });
    expect(insert).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("sessão expirada ainda vence: quem não é admin não fica sabendo do modo leitura", async () => {
    sessao.sessaoDeAdmin.mockResolvedValue(null);
    expect(await prepararUpload(CAFE, AUTORIZACAO, WEBP)).toEqual({
      ok: false,
      falha: { etapa: "preparar", codigo: "sessao" },
    });
  });
});

describe("registrarFoto", () => {
  it("o exists lança (Supabase sem resposta): falha própria, não 'arquivo não chegou'", async () => {
    storage.exists.mockRejectedValue({ name: "StorageApiError", message: "Gateway Timeout", status: 504 });
    const r = await registrarFoto(CAFE, CAMINHO, AUTORIZACAO);
    expect(r).toMatchObject({ ok: false, falha: { etapa: "registrar", codigo: "exists" } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("arquivo não chegou ao bucket: sem-arquivo", async () => {
    storage.exists.mockResolvedValue({ data: false, error: { status: 404 } });
    const r = await registrarFoto(CAFE, CAMINHO, AUTORIZACAO);
    expect(r).toMatchObject({ ok: false, falha: { etapa: "registrar", codigo: "sem-arquivo" } });
  });

  it("tabela inexistente: código do Postgres na falha, arquivo apagado", async () => {
    insert.mockResolvedValue({ error: { code: "42P01", message: 'relation "public.cafe_fotos" does not exist' } });
    const r = await registrarFoto(CAFE, CAMINHO, AUTORIZACAO);
    expect(r).toEqual({
      ok: false,
      falha: { etapa: "registrar", codigo: "42P01", original: 'relation "public.cafe_fotos" does not exist' },
    });
    expect(storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("registro e remoção falham: avisa do órfão com o caminho", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    storage.remove.mockResolvedValue({ data: null, error: { message: "Forbidden" } });
    const r = await registrarFoto(CAFE, CAMINHO, AUTORIZACAO);
    expect(r).toMatchObject({ ok: false, falha: { codigo: "42501", orfao: true, caminho: CAMINHO } });
    expect(textoDoLog()).toContain(CAMINHO);
  });

  it("sessão expirada: falha de sessão, sem apagar nada", async () => {
    sessao.sessaoDeAdmin.mockResolvedValue(null);
    expect(await registrarFoto(CAFE, CAMINHO, AUTORIZACAO)).toEqual({
      ok: false,
      falha: { etapa: "registrar", codigo: "sessao" },
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("o log nunca leva a URL assinada nem token", async () => {
    storage.exists.mockRejectedValue({ name: "StorageUnknownError", message: `fetch failed ${URL_ASSINADA}` });
    await registrarFoto(CAFE, CAMINHO, AUTORIZACAO);
    expect(log).toHaveBeenCalled();
    expect(textoDoLog()).not.toMatch(/token|eyJ|https:/);
  });
});

describe("registrarFoto — foto temporária (#92)", () => {
  it("marcada no envio: a linha nasce temporária", async () => {
    expect(await registrarFoto(CAFE, CAMINHO, AUTORIZACAO, true)).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ temporaria: true }));
  });

  it("sem marcar (ou com qualquer valor que não seja true): definitiva", async () => {
    await registrarFoto(CAFE, CAMINHO, AUTORIZACAO, false);
    await registrarFoto(CAFE, CAMINHO, AUTORIZACAO, "true" as unknown as boolean);
    expect(insert.mock.calls.map(([linha]) => linha.temporaria)).toEqual([false, false]);
  });
});

describe("marcarTemporaria (#92)", () => {
  it("grava só a marca, no estado pedido", async () => {
    expect(await marcarTemporaria(CAFE, FOTO, true)).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ temporaria: true }, { count: "exact" });
    await marcarTemporaria(CAFE, FOTO, false);
    expect(update).toHaveBeenLastCalledWith({ temporaria: false }, { count: "exact" });
  });

  it("começa pela checagem de admin", async () => {
    sessao.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(marcarTemporaria(CAFE, FOTO, true)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    sessao.requireAdmin.mockReset();
  });

  it("modo leitura: recusa sem gravar", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
    expect(await marcarTemporaria(CAFE, FOTO, true)).toMatchObject({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("foto que não é deste café: erro, nada gravado", async () => {
    expect(await marcarTemporaria(CAFE, "outra", true)).toMatchObject({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("a RLS não deixou gravar (nenhuma linha): erro", async () => {
    resultadoUpdate.mockResolvedValue({ error: null, count: 0 });
    expect(await marcarTemporaria(CAFE, FOTO, true)).toMatchObject({ ok: false });
  });
});
