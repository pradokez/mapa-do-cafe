import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Edicao, Participacao } from "@/lib/festival";

/**
 * Admin dos festivais (#102): o que chega ao banco e o que volta para a tela.
 * Supabase, sessão, repositório e cache são dublês — a RLS e os `unique` reais
 * são conferidos à mão (roteiro na PR).
 */

vi.mock("server-only", () => ({}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cache);

const sessao = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const repo = vi.hoisted(() => ({
  getEdicaoById: vi.fn(),
  getCafeById: vi.fn(),
  listFestivaisCadastrados: vi.fn(),
  CAFES_TAG: "cafes",
  FESTIVAIS_TAG: "festivais",
}));
vi.mock("@/lib/cafe-repository", () => repo);

/** Toda chamada ao client termina num `eq` (update/delete) ou no próprio `insert`. */
const banco = vi.hoisted(() => {
  const resposta = { atual: { error: null as { code: string; message: string } | null, count: 1 as number | null } };
  const eq = vi.fn(() => Promise.resolve(resposta.atual));
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => Promise.resolve(resposta.atual));
  const from = vi.fn(() => ({ update, insert, delete: del }));
  return { resposta, eq, update, del, insert, from };
});
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: () => ({ from: banco.from }) }));

import {
  adicionarParticipante,
  cadastrarEdicao,
  definirPublicacao,
  removerParticipante,
  salvarEdicao,
  salvarParticipante,
} from "./festivais-actions";

const EDICAO_ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const CAFE_ID = "0b4a1f6e-2f61-4d7c-9a31-0c8f3f1f0a11";
const PART_ID = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const OUTRA_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const participacao = (campos: Partial<Participacao> = {}): Participacao => ({
  id: PART_ID,
  cafe_id: CAFE_ID,
  numero: null,
  nome_combo: null,
  alt: null,
  instagram_url: null,
  arte: null,
  ...campos,
});

const EDICAO: Edicao = {
  id: EDICAO_ID,
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: false,
  participacoes: [participacao()],
};

const CAMPOS_EDICAO = { inicio: "2026-10-18", fim: "2026-11-15", descricao: "", preco: "34,90" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  sessao.requireAdmin.mockResolvedValue({ email: "admin@x" });
  banco.resposta.atual = { error: null, count: 1 };
  repo.getEdicaoById.mockResolvedValue(EDICAO);
  repo.getCafeById.mockResolvedValue(cafe(CAFE_ID, { nome: "Borsoi" }));
  repo.listFestivaisCadastrados.mockResolvedValue([
    { id: "f-eu-amo", slug: "eu-amo-cafe", nome: "Eu Amo Café" },
    { id: "f-recife", slug: "recife-coffee", nome: "Recife Coffee" },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const ACOES = [
  ["cadastrarEdicao", () => cadastrarEdicao("eu-amo-cafe", CAMPOS_EDICAO)],
  ["salvarEdicao", () => salvarEdicao(EDICAO_ID, CAMPOS_EDICAO)],
  ["definirPublicacao", () => definirPublicacao(EDICAO_ID, true)],
  ["adicionarParticipante", () => adicionarParticipante(EDICAO_ID, OUTRA_ID)],
  ["salvarParticipante", () => salvarParticipante(EDICAO_ID, PART_ID, { numero: "1" })],
  ["removerParticipante", () => removerParticipante(EDICAO_ID, PART_ID)],
] as const;

describe.each(ACOES)("%s", (_nome, acao) => {
  it("fora da produção, sem a liberação, o modo leitura recusa antes do banco", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
    expect(await acao()).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("erro do banco não vira sucesso nem revalida", async () => {
    banco.resposta.atual = { error: { code: "42501", message: "permission denied" }, count: null };
    expect(await acao()).toMatchObject({ ok: false });
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("cadastrarEdicao", () => {
  it("grava a edição fora do ar, com o ano do início e o id do servidor", async () => {
    const resultado = await cadastrarEdicao("recife-coffee", { ...CAMPOS_EDICAO, publicada: true });

    expect(resultado).toMatchObject({ ok: true });
    expect(banco.from).toHaveBeenCalledWith("festival_edicoes");
    expect(banco.insert).toHaveBeenCalledWith({
      id: resultado.ok && resultado.id,
      festival_id: "f-recife",
      ano: 2026,
      inicio: "2026-10-18",
      fim: "2026-11-15",
      descricao: null,
      preco: 3490,
      publicada: false,
    });
  });

  it("fim antes do início não chega ao banco", async () => {
    expect(await cadastrarEdicao("eu-amo-cafe", { ...CAMPOS_EDICAO, fim: "2026-10-01" })).toEqual({
      ok: false,
      erro: null,
      erros: { fim: "O fim não pode ser antes do início." },
    });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("festival desconhecido não chega ao banco", async () => {
    expect(await cadastrarEdicao("festival-x", CAMPOS_EDICAO)).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("ano repetido no festival vira mensagem no campo do início", async () => {
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" }, count: null };
    expect(await cadastrarEdicao("eu-amo-cafe", CAMPOS_EDICAO)).toEqual({
      ok: false,
      erro: null,
      erros: { inicio: "Já existe Eu Amo Café 2026. Abra essa edição na lista para editar." },
    });
  });
});

describe("salvarEdicao", () => {
  it("grava só datas, descrição e preço (nunca festival nem publicação) e revalida o site", async () => {
    const resultado = await salvarEdicao(EDICAO_ID, { ...CAMPOS_EDICAO, preco: "45", festival_id: "x", publicada: true });

    expect(resultado).toMatchObject({ ok: true });
    expect(banco.update).toHaveBeenCalledWith(
      { ano: 2026, inicio: "2026-10-18", fim: "2026-11-15", descricao: null, preco: 4500 },
      { count: "exact" },
    );
    expect(banco.eq).toHaveBeenCalledWith("id", EDICAO_ID);
    expect(cache.revalidateTag).toHaveBeenCalledWith("festivais");
    expect(cache.revalidateTag).toHaveBeenCalledWith("cafes");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/festivais/eu-amo-cafe/2026");
  });

  it("edição publicada não pode perder o preço", async () => {
    repo.getEdicaoById.mockResolvedValue({ ...EDICAO, publicada: true });
    expect(await salvarEdicao(EDICAO_ID, { ...CAMPOS_EDICAO, preco: "" })).toEqual({
      ok: false,
      erro: null,
      erros: { preco: "Edição publicada precisa de preço. Despublique antes de apagar." },
    });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("mudar o ano para um já cadastrado vira mensagem", async () => {
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" }, count: null };
    expect(await salvarEdicao(EDICAO_ID, { ...CAMPOS_EDICAO, inicio: "2027-10-18", fim: "2027-11-01" })).toMatchObject({
      ok: false,
      erros: { inicio: "Já existe Eu Amo Café 2027. Abra essa edição na lista para editar." },
    });
  });

  it("edição inexistente ou id malformado", async () => {
    repo.getEdicaoById.mockResolvedValue(null);
    expect(await salvarEdicao(EDICAO_ID, CAMPOS_EDICAO)).toMatchObject({ ok: false });
    expect(await salvarEdicao("1 or 1=1", CAMPOS_EDICAO)).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("update que não muda linha (barrado pela RLS) é erro", async () => {
    banco.resposta.atual = { error: null, count: 0 };
    expect(await salvarEdicao(EDICAO_ID, CAMPOS_EDICAO)).toMatchObject({ ok: false });
  });
});

describe("definirPublicacao", () => {
  it("grava o estado pedido e revalida a página da edição", async () => {
    expect(await definirPublicacao(EDICAO_ID, true)).toEqual({ ok: true });
    expect(banco.update).toHaveBeenCalledWith({ publicada: true }, { count: "exact" });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/festivais/eu-amo-cafe/2026");
  });

  it("publicar sem preço é recusado antes do banco; despublicar não precisa", async () => {
    repo.getEdicaoById.mockResolvedValue({ ...EDICAO, preco: null });
    expect(await definirPublicacao(EDICAO_ID, true)).toEqual({
      ok: false,
      erro: "Preencha o preço do combo antes de publicar.",
    });
    expect(banco.from).not.toHaveBeenCalled();

    expect(await definirPublicacao(EDICAO_ID, false)).toEqual({ ok: true });
  });

  it("valor que não é booleano não chega ao banco", async () => {
    expect(await definirPublicacao(EDICAO_ID, "true" as unknown as boolean)).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });
});

describe("adicionarParticipante", () => {
  it("insere o café na edição, sem número nem arte", async () => {
    repo.getCafeById.mockResolvedValue(cafe(OUTRA_ID));
    expect(await adicionarParticipante(EDICAO_ID, OUTRA_ID)).toEqual({ ok: true });
    expect(banco.from).toHaveBeenCalledWith("festival_participacoes");
    expect(banco.insert).toHaveBeenCalledWith({ edicao_id: EDICAO_ID, cafe_id: OUTRA_ID });
  });

  it("café que já participa não entra de novo", async () => {
    expect(await adicionarParticipante(EDICAO_ID, CAFE_ID)).toEqual({
      ok: false,
      erro: "Borsoi já está nesta edição.",
    });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("corrida com outra aba: o `unique` do banco vira a mesma mensagem", async () => {
    repo.getCafeById.mockResolvedValue(cafe(OUTRA_ID, { nome: "Castigliani" }));
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" }, count: null };
    expect(await adicionarParticipante(EDICAO_ID, OUTRA_ID)).toEqual({
      ok: false,
      erro: "Castigliani já está nesta edição.",
    });
  });

  it("café fora do ar ou inexistente não entra", async () => {
    repo.getCafeById.mockResolvedValue(cafe(OUTRA_ID, { ativo: false }));
    expect(await adicionarParticipante(EDICAO_ID, OUTRA_ID)).toMatchObject({ ok: false });
    repo.getCafeById.mockResolvedValue(null);
    expect(await adicionarParticipante(EDICAO_ID, OUTRA_ID)).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });
});

describe("salvarParticipante", () => {
  it("grava os campos normalizados no participante da edição", async () => {
    const resultado = await salvarParticipante(EDICAO_ID, PART_ID, {
      numero: "13",
      nome_combo: "Espresso + bolo",
      alt: "",
      instagram_url: "instagram.com/p/DAbc?igsh=1",
      arte_path: "outro/caminho.webp",
    });

    const valores = { numero: 13, nome_combo: "Espresso + bolo", alt: null, instagram_url: "https://www.instagram.com/p/DAbc/" };
    expect(resultado).toEqual({ ok: true, valores });
    expect(banco.update).toHaveBeenCalledWith(
      { numero: 13, nome_combo: "Espresso + bolo", alt: null, instagram_url: "https://www.instagram.com/p/DAbc/" },
      { count: "exact" },
    );
    expect(banco.eq).toHaveBeenCalledWith("id", PART_ID);
  });

  it("número de outro participante é recusado, dizendo de quem é", async () => {
    repo.getEdicaoById.mockResolvedValue({
      ...EDICAO,
      participacoes: [participacao(), participacao({ id: OUTRA_ID, cafe_id: OUTRA_ID, numero: 13 })],
    });
    repo.getCafeById.mockResolvedValue(cafe(OUTRA_ID, { nome: "Castigliani" }));

    expect(await salvarParticipante(EDICAO_ID, PART_ID, { numero: "13" })).toEqual({
      ok: false,
      erro: null,
      erros: { numero: "O número 13 já é de Castigliani." },
    });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("corrida com outra aba: o `unique` do número vira mensagem no campo", async () => {
    banco.resposta.atual = { error: { code: "23505", message: "duplicate key" }, count: null };
    expect(await salvarParticipante(EDICAO_ID, PART_ID, { numero: "13" })).toEqual({
      ok: false,
      erro: null,
      erros: { numero: "O número 13 já é de outro café." },
    });
  });

  it("com arte, o alt é obrigatório — quem diz se há arte é o banco", async () => {
    repo.getEdicaoById.mockResolvedValue({ ...EDICAO, participacoes: [participacao({ arte: "https://x/a.webp" })] });
    expect(await salvarParticipante(EDICAO_ID, PART_ID, { alt: "" })).toMatchObject({
      ok: false,
      erros: { alt: expect.any(String) },
    });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("participante de outra edição não é tocado", async () => {
    expect(await salvarParticipante(EDICAO_ID, OUTRA_ID, { numero: "1" })).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });
});

describe("removerParticipante", () => {
  it("apaga a linha do participante da edição", async () => {
    expect(await removerParticipante(EDICAO_ID, PART_ID)).toEqual({ ok: true });
    expect(banco.del).toHaveBeenCalledWith({ count: "exact" });
    expect(banco.eq).toHaveBeenCalledWith("id", PART_ID);
  });

  it("participante de outra edição não é apagado", async () => {
    expect(await removerParticipante(EDICAO_ID, OUTRA_ID)).toMatchObject({ ok: false });
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("delete que não apaga linha é erro", async () => {
    banco.resposta.atual = { error: null, count: 0 };
    expect(await removerParticipante(EDICAO_ID, PART_ID)).toMatchObject({ ok: false });
  });
});
