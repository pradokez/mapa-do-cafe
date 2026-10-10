import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Edicao, Participacao } from "@/lib/festival";

/**
 * Artes dos combos (#105): o mesmo fluxo das fotos — URL assinada, `PUT`
 * direto, registro —, com o caminho da edição. Supabase, sessão, repositório
 * e cache são dublês; o que se prova é o que chega ao banco e ao bucket.
 */

vi.mock("server-only", () => ({}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cache);

const sessao = vi.hoisted(() => ({ sessaoDeAdmin: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const repo = vi.hoisted(() => ({
  getEdicaoById: vi.fn(),
  listArtesDaEdicao: vi.fn(),
  arteRegistrada: vi.fn(),
  CAFES_TAG: "cafes",
  FESTIVAIS_TAG: "festivais",
}));
vi.mock("@/lib/cafe-repository", () => repo);

const banco = vi.hoisted(() => {
  const resposta = { atual: { error: null as { code: string; message: string } | null, count: 1 as number | null } };
  const eq = vi.fn(() => Promise.resolve(resposta.atual));
  const update = vi.fn(() => ({ eq }));
  const storage = { createSignedUploadUrl: vi.fn(), exists: vi.fn(), remove: vi.fn() };
  return { resposta, eq, update, storage };
});
vi.mock("@/lib/supabase-server", () => ({
  createSessionClient: () => ({ from: () => ({ update: banco.update }), storage: { from: () => banco.storage } }),
}));

import { descartarArte, prepararArte, registrarArte, removerArte } from "./artes-actions";

const EDICAO_ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const OUTRA_EDICAO = "0b3a4c1e-2d5f-4a6b-8c7d-9e0f1a2b3c4d";
const PART_ID = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const CAMINHO = `${EDICAO_ID}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;
const ANTIGO = `${EDICAO_ID}/11111111-2222-4333-8444-555555555555.webp`;
const WEBP = { type: "image/webp", size: 1000 };
const AUTORIZACAO = { autorizado_por: "ASCAPE", autorizado_em: "2026-10-01" };
const CAMPOS = { numero: "13", nome_combo: "Espresso + bolo", alt: "Combo 13: espresso e bolo de rolo.", instagram_url: "", ...AUTORIZACAO };

const participacao = (campos: Partial<Participacao> = {}): Participacao => ({
  id: PART_ID,
  cafe_id: "0b4a1f6e-2f61-4d7c-9a31-0c8f3f1f0a11",
  numero: null,
  nome_combo: null,
  alt: null,
  instagram_url: null,
  arte: null,
  ...campos,
});

const edicao = (participacoes: Participacao[] = [participacao()]): Edicao => ({
  id: EDICAO_ID,
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes,
});

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  sessao.sessaoDeAdmin.mockResolvedValue({ email: "admin@x" });
  repo.getEdicaoById.mockResolvedValue(edicao());
  repo.listArtesDaEdicao.mockResolvedValue({});
  repo.arteRegistrada.mockResolvedValue(false);
  banco.resposta.atual = { error: null, count: 1 };
  banco.storage.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://x/sign?token=y" }, error: null });
  banco.storage.exists.mockResolvedValue({ data: true, error: null });
  banco.storage.remove.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  log.mockRestore();
  vi.unstubAllEnvs();
});

describe("prepararArte", () => {
  it("devolve uma URL assinada para um caminho novo na pasta da edição", async () => {
    const r = await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, WEBP);
    expect(r).toMatchObject({ ok: true, url: "https://x/sign?token=y" });
    expect(r.ok && r.caminho).toMatch(new RegExp(`^${EDICAO_ID}/[0-9a-f-]{36}\\.webp$`));
  });

  it("sem autorização, não pede URL: erro por campo", async () => {
    const r = await prepararArte(EDICAO_ID, PART_ID, {}, WEBP);
    expect(r).toEqual({
      ok: false,
      falha: null,
      erros: { autorizado_por: "Diga quem autorizou.", autorizado_em: "Informe a data da autorização." },
    });
    expect(banco.storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("arquivo que não é WebP ou passa de 2 MB é recusado de novo no servidor", async () => {
    expect(await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, { type: "image/png", size: 1000 })).toMatchObject({
      ok: false,
      falha: { codigo: "415" },
    });
    expect(await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, { type: "image/webp", size: 3 * 1024 * 1024 })).toMatchObject({
      ok: false,
      falha: { codigo: "413" },
    });
    expect(banco.storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("participação que não é desta edição: falha participante", async () => {
    repo.getEdicaoById.mockResolvedValue(edicao([]));
    expect(await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, WEBP)).toMatchObject({
      ok: false,
      falha: { etapa: "preparar", codigo: "participante" },
    });
  });

  it("sessão expirada e modo leitura não chegam ao Storage", async () => {
    sessao.sessaoDeAdmin.mockResolvedValueOnce(null);
    expect(await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, WEBP)).toEqual({
      ok: false,
      falha: { etapa: "preparar", codigo: "sessao" },
    });
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
    expect(await prepararArte(EDICAO_ID, PART_ID, AUTORIZACAO, WEBP)).toEqual({
      ok: false,
      falha: { etapa: "preparar", codigo: "modo-leitura" },
    });
    expect(banco.storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});

describe("registrarArte", () => {
  it("grava dados, arte e autorização numa escrita só, e revalida o site", async () => {
    const r = await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS);
    expect(r).toEqual({
      ok: true,
      valores: { numero: 13, nome_combo: "Espresso + bolo", alt: "Combo 13: espresso e bolo de rolo.", instagram_url: null },
    });
    expect(banco.update).toHaveBeenCalledTimes(1);
    expect(banco.update).toHaveBeenCalledWith(
      {
        numero: 13,
        nome_combo: "Espresso + bolo",
        alt: "Combo 13: espresso e bolo de rolo.",
        instagram_url: null,
        arte_path: CAMINHO,
        autorizado_por: "ASCAPE",
        autorizado_em: "2026-10-01",
      },
      { count: "exact" },
    );
    expect(banco.eq).toHaveBeenCalledWith("id", PART_ID);
    expect(banco.storage.remove).not.toHaveBeenCalled();
    expect(cache.revalidateTag).toHaveBeenCalledWith("festivais");
  });

  it("trocar a arte apaga o arquivo antigo depois de gravar o novo", async () => {
    repo.listArtesDaEdicao.mockResolvedValue({ [PART_ID]: { caminho: ANTIGO, ...AUTORIZACAO } });
    expect((await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS)).ok).toBe(true);
    expect(banco.storage.remove).toHaveBeenCalledWith([ANTIGO]);
  });

  it("caminho de outra edição é recusado sem tocar no banco nem no bucket", async () => {
    const outro = `${OUTRA_EDICAO}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;
    expect(await registrarArte(EDICAO_ID, PART_ID, outro, CAMPOS)).toMatchObject({ ok: false });
    expect(banco.update).not.toHaveBeenCalled();
    expect(banco.storage.remove).not.toHaveBeenCalled();
  });

  it("sem alt: recusa e apaga o arquivo novo (não há arte sem texto alternativo)", async () => {
    const r = await registrarArte(EDICAO_ID, PART_ID, CAMINHO, { ...CAMPOS, alt: "  " });
    expect(r).toMatchObject({ ok: false, falha: null, erros: { alt: expect.any(String) } });
    expect(banco.update).not.toHaveBeenCalled();
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("sem autorização: recusa e apaga o arquivo novo", async () => {
    const r = await registrarArte(EDICAO_ID, PART_ID, CAMINHO, { ...CAMPOS, autorizado_por: "" });
    expect(r).toMatchObject({ ok: false, erros: { autorizado_por: "Diga quem autorizou." } });
    expect(banco.update).not.toHaveBeenCalled();
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("falha no banco apaga o arquivo novo e mantém o antigo", async () => {
    repo.listArtesDaEdicao.mockResolvedValue({ [PART_ID]: { caminho: ANTIGO, ...AUTORIZACAO } });
    banco.resposta.atual = { error: { code: "42501", message: "permission denied" }, count: null };
    expect(await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS)).toMatchObject({
      ok: false,
      falha: { etapa: "registrar", codigo: "42501" },
    });
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
    expect(banco.storage.remove).not.toHaveBeenCalledWith([ANTIGO]);
  });

  it("update sem linha (RLS) também é falha, e apaga o arquivo novo", async () => {
    banco.resposta.atual = { error: null, count: 0 };
    expect((await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS)).ok).toBe(false);
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("número de outro café: erro no campo, e o arquivo novo sai", async () => {
    repo.getEdicaoById.mockResolvedValue(
      edicao([participacao(), participacao({ id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", numero: 13 })]),
    );
    expect(await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS)).toMatchObject({
      ok: false,
      erros: { numero: expect.stringMatching(/13/) },
    });
    expect(banco.update).not.toHaveBeenCalled();
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("arquivo que não chegou ao bucket: não grava a linha", async () => {
    banco.storage.exists.mockResolvedValue({ data: false, error: null });
    expect(await registrarArte(EDICAO_ID, PART_ID, CAMINHO, CAMPOS)).toMatchObject({
      ok: false,
      falha: { codigo: "sem-arquivo" },
    });
    expect(banco.update).not.toHaveBeenCalled();
  });
});

describe("descartarArte (o registro não respondeu)", () => {
  it("apaga o arquivo que não virou arte de ninguém", async () => {
    await descartarArte(EDICAO_ID, CAMINHO);
    expect(banco.storage.remove).toHaveBeenCalledWith([CAMINHO]);
  });

  it("não apaga se o registro entrou mesmo assim", async () => {
    repo.arteRegistrada.mockResolvedValue(true);
    await descartarArte(EDICAO_ID, CAMINHO);
    expect(banco.storage.remove).not.toHaveBeenCalled();
  });

  it("caminho de outra edição: nada", async () => {
    await descartarArte(OUTRA_EDICAO, CAMINHO);
    expect(banco.storage.remove).not.toHaveBeenCalled();
  });
});

describe("removerArte", () => {
  beforeEach(() => {
    repo.getEdicaoById.mockResolvedValue(edicao([participacao({ arte: "https://x/arte.webp", alt: "Combo" })]));
    repo.listArtesDaEdicao.mockResolvedValue({ [PART_ID]: { caminho: ANTIGO, ...AUTORIZACAO } });
  });

  it("limpa a arte e a autorização na linha, depois apaga o arquivo", async () => {
    const ordem: string[] = [];
    banco.update.mockImplementationOnce(() => {
      ordem.push("linha");
      return { eq: banco.eq };
    });
    banco.storage.remove.mockImplementationOnce(async () => {
      ordem.push("arquivo");
      return { data: [], error: null };
    });
    expect(await removerArte(EDICAO_ID, PART_ID)).toEqual({ ok: true });
    expect(banco.update).toHaveBeenCalledWith(
      { arte_path: null, autorizado_por: null, autorizado_em: null },
      { count: "exact" },
    );
    expect(banco.storage.remove).toHaveBeenCalledWith([ANTIGO]);
    expect(ordem).toEqual(["linha", "arquivo"]);
    expect(cache.revalidateTag).toHaveBeenCalledWith("festivais");
  });

  it("se a linha não muda, o arquivo fica", async () => {
    banco.resposta.atual = { error: null, count: 0 };
    expect((await removerArte(EDICAO_ID, PART_ID)).ok).toBe(false);
    expect(banco.storage.remove).not.toHaveBeenCalled();
  });

  it("modo leitura não toca em nada", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
    expect((await removerArte(EDICAO_ID, PART_ID)).ok).toBe(false);
    expect(banco.update).not.toHaveBeenCalled();
  });
});
