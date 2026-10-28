import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Revisao } from "@/lib/revisao";

/**
 * Decisão sobre as revisões da curadoria (#182): o que chega a `cafes` e a
 * `revisoes` ao aprovar e rejeitar. Supabase, sessão, repositório e cache são
 * dublês — a RLS e os grants reais são conferidos à mão.
 */

vi.mock("server-only", () => ({}));
const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/cache", () => cache);

// Como o do Next: `redirect` lança, e nada depois dele roda.
const navegacao = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => navegacao);

const sessao = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("./require-admin", () => sessao);

const repo = vi.hoisted(() => ({
  getRevisaoById: vi.fn(),
  getCafeById: vi.fn(),
  CAFES_TAG: "cafes",
  FESTIVAIS_TAG: "festivais",
}));
vi.mock("@/lib/cafe-repository", () => repo);

/** Cada `update` vira um registro com a tabela, os valores e os filtros; a resposta é por tabela. */
const banco = vi.hoisted(() => {
  type Filtro = [string, string, unknown];
  type Update = { tabela: string; valores: unknown; filtros: Filtro[] };
  const updates: Update[] = [];
  const respostas: Record<string, { error: { code: string } | null; count: number | null }> = {};
  const from = vi.fn((tabela: string) => ({
    update(valores: unknown) {
      const registro: Update = { tabela, valores, filtros: [] };
      updates.push(registro);
      const consulta = {
        eq: (coluna: string, valor: unknown) => (registro.filtros.push(["eq", coluna, valor]), consulta),
        in: (coluna: string, valor: unknown) => (registro.filtros.push(["in", coluna, valor]), consulta),
        is: (coluna: string, valor: unknown) => (registro.filtros.push(["is", coluna, valor]), consulta),
        then: (ok: (r: unknown) => unknown, falha: (e: unknown) => unknown) =>
          Promise.resolve(respostas[tabela] ?? { error: null, count: 1 }).then(ok, falha),
      };
      return consulta;
    },
  }));
  return { updates, respostas, from };
});
vi.mock("@/lib/supabase-server", () => ({
  createSessionClient: () => ({ from: banco.from }),
}));

import { marcarRevisaoAprovada } from "./revisoes";
import { aprovarRevisao, rejeitarRevisao } from "./revisoes-actions";

const ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const CAFE_ID = "0b4a1f6e-2f61-4d7c-9a31-0c8f3f1f0a11";
const CAFE = cafe(CAFE_ID, {
  slug: "cafe-a",
  instagram: "https://instagram.com/antigo",
});

const revisao = (mudancas: Partial<Revisao> = {}): Revisao => ({
  id: ID,
  tipo: "atualizacao",
  cafe_id: CAFE_ID,
  campo: "instagram",
  valor_atual: "https://instagram.com/antigo",
  valor_proposto: "@novo",
  fontes: [],
  atualidade: "atualizada",
  status: "pendente",
  criado_em: "2026-10-27T12:00:00Z",
  decidido_em: null,
  cafe: { nome: CAFE.nome, slug: CAFE.slug, ativo: true },
  nome_proposto: null,
  ...mudancas,
});

function form(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [k, v] of Object.entries(campos)) dados.set(k, v);
  return dados;
}

const updatesEm = (tabela: string) => banco.updates.filter((u) => u.tabela === tabela);

beforeEach(() => {
  vi.clearAllMocks();
  banco.updates.length = 0;
  for (const tabela of Object.keys(banco.respostas)) delete banco.respostas[tabela];
  vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "1");
  sessao.requireAdmin.mockResolvedValue({ email: "admin@x" });
  repo.getRevisaoById.mockResolvedValue(revisao());
  repo.getCafeById.mockResolvedValue(CAFE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aprovarRevisao — atualização", () => {
  it("grava só o campo, já normalizado pelo cafe-dados, revalida o café e marca a revisão aprovada", async () => {
    const resultado = await aprovarRevisao(null, form({ id: ID }));

    expect(resultado).toEqual({ ok: true, id: ID, status: "aprovada" });
    expect(updatesEm("cafes")).toEqual([
      {
        tabela: "cafes",
        valores: { instagram: "https://instagram.com/novo" },
        filtros: [["eq", "id", CAFE_ID]],
      },
    ]);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/cafes/cafe-a");
    expect(updatesEm("revisoes")).toEqual([
      {
        tabela: "revisoes",
        valores: { status: "aprovada" },
        filtros: expect.arrayContaining([
          ["eq", "id", ID],
          ["eq", "status", "pendente"],
        ]),
      },
    ]);
  });

  it("valor no banco diferente do que o robô viu → obsoleta, sem tocar em cafes (não sobrescreve edição à mão)", async () => {
    repo.getCafeById.mockResolvedValue({
      ...CAFE,
      instagram: "https://instagram.com/editado",
    });

    const resultado = await aprovarRevisao(null, form({ id: ID }));

    expect(resultado).toEqual({ ok: true, id: ID, status: "obsoleta" });
    expect(updatesEm("cafes")).toEqual([]);
    expect(updatesEm("revisoes")).toEqual([
      {
        tabela: "revisoes",
        valores: { status: "obsoleta" },
        filtros: [
          ["eq", "id", ID],
          ["in", "status", ["pendente"]],
        ],
      },
    ]);
  });

  it("horário igual com as chaves em outra ordem não é obsoleto", async () => {
    const horario = { ...CAFE.horario_funcionamento };
    const invertido = Object.fromEntries(Object.entries(horario).reverse());
    repo.getRevisaoById.mockResolvedValue(
      revisao({
        campo: "horario_funcionamento",
        valor_atual: invertido,
        valor_proposto: { ...horario, segunda: "08:00 – 18:00" },
      }),
    );

    expect(await aprovarRevisao(null, form({ id: ID }))).toEqual({
      ok: true,
      id: ID,
      status: "aprovada",
    });
    expect(updatesEm("cafes")[0].valores).toEqual({
      horario_funcionamento: { ...horario, segunda: "08:00 – 18:00" },
    });
  });
});

describe("aprovarRevisao — o que não grava", () => {
  it("proposta que não passa pelo cafe-dados é erro e não grava nada", async () => {
    repo.getRevisaoById.mockResolvedValue(revisao({ valor_proposto: "https://example.com/x" }));

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
    expect(banco.updates).toEqual([]);
  });

  it.each(["antiga", "sem_data", "conflito"] as const)(
    "%s sem confirmação é recusada, sem gravar",
    async (atualidade) => {
      repo.getRevisaoById.mockResolvedValue(revisao({ atualidade }));

      expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
        ok: false,
      });
      expect(await aprovarRevisao(null, form({ id: ID, confirmacao: "sim" }))).toMatchObject({ ok: false });
      expect(banco.updates).toEqual([]);
    },
  );

  it("antiga com a confirmação do form grava", async () => {
    repo.getRevisaoById.mockResolvedValue(revisao({ atualidade: "antiga" }));

    expect(await aprovarRevisao(null, form({ id: ID, confirmacao: "1" }))).toEqual({
      ok: true,
      id: ID,
      status: "aprovada",
    });
    expect(updatesEm("cafes")).toHaveLength(1);
  });

  it.each(["aprovada", "rejeitada", "obsoleta"] as const)("revisão já %s não se aprova de novo", async (status) => {
    repo.getRevisaoById.mockResolvedValue(revisao({ status }));

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
    expect(banco.updates).toEqual([]);
  });

  describe("café novo (#187)", () => {
    const novo = (mudancas: Partial<Revisao> = {}) =>
      revisao({
        tipo: "cafe_novo",
        cafe_id: null,
        campo: null,
        valor_atual: null,
        valor_proposto: { nome: "Novo" },
        cafe: null,
        ...mudancas,
      });

    it("não grava nada: abre o cadastro preenchido com a revisão", async () => {
      repo.getRevisaoById.mockResolvedValue(novo());

      await expect(aprovarRevisao(null, form({ id: ID }))).rejects.toThrow("NEXT_REDIRECT");
      expect(navegacao.redirect).toHaveBeenCalledWith(`/admin/cafes/novo?revisao=${ID}`);
      expect(banco.from).not.toHaveBeenCalled();
      expect(repo.getCafeById).not.toHaveBeenCalled();
    });

    it("não pede confirmação, nem com a fonte sem data: o cadastro mostra as fontes", async () => {
      repo.getRevisaoById.mockResolvedValue(novo({ atualidade: "sem_data" }));

      await expect(aprovarRevisao(null, form({ id: ID }))).rejects.toThrow("NEXT_REDIRECT");
      expect(navegacao.redirect).toHaveBeenCalledWith(`/admin/cafes/novo?revisao=${ID}`);
    });

    it("já decidido não abre o cadastro", async () => {
      repo.getRevisaoById.mockResolvedValue(novo({ status: "rejeitada" }));

      expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({ ok: false, id: ID });
      expect(navegacao.redirect).not.toHaveBeenCalled();
    });

    it("no modo leitura, nem abre o cadastro", async () => {
      vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");
      repo.getRevisaoById.mockResolvedValue(novo());

      expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({ ok: false });
      expect(navegacao.redirect).not.toHaveBeenCalled();
    });
  });

  it("indício sem campo (fechado temporariamente) não se aprova", async () => {
    repo.getRevisaoById.mockResolvedValue(
      revisao({
        campo: null,
        valor_proposto: { motivo: "fechado_temporariamente" },
      }),
    );

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
    expect(banco.updates).toEqual([]);
  });

  it("revisão inexistente é erro", async () => {
    repo.getRevisaoById.mockResolvedValue(null);

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
    expect(banco.updates).toEqual([]);
  });
});

describe("aprovarRevisao — fechamento", () => {
  const fechamento = (mudancas: Partial<Revisao> = {}) =>
    revisao({
      tipo: "fechamento",
      campo: null,
      valor_atual: { ativo: true },
      valor_proposto: { ativo: false },
      ...mudancas,
    });

  it("grava só ativo = false, revalida o café e marca a revisão aprovada", async () => {
    repo.getRevisaoById.mockResolvedValue(fechamento());

    expect(await aprovarRevisao(null, form({ id: ID }))).toEqual({
      ok: true,
      id: ID,
      status: "aprovada",
    });
    expect(updatesEm("cafes")).toEqual([
      {
        tabela: "cafes",
        valores: { ativo: false },
        filtros: [["eq", "id", CAFE_ID]],
      },
    ]);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/cafes/cafe-a");
    expect(updatesEm("revisoes")[0].valores).toEqual({ status: "aprovada" });
  });

  it("café que já saiu do ar → obsoleta, sem tocar em cafes", async () => {
    repo.getRevisaoById.mockResolvedValue(fechamento());
    repo.getCafeById.mockResolvedValue({ ...CAFE, ativo: false });

    expect(await aprovarRevisao(null, form({ id: ID }))).toEqual({
      ok: true,
      id: ID,
      status: "obsoleta",
    });
    expect(updatesEm("cafes")).toEqual([]);
  });

  it("update de cafes que não muda linha (RLS) é erro, e a revisão fica pendente", async () => {
    repo.getRevisaoById.mockResolvedValue(fechamento());
    banco.respostas.cafes = { error: null, count: 0 };

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
    expect(updatesEm("revisoes")).toEqual([]);
  });
});

describe.each([
  ["aprovarRevisao", aprovarRevisao],
  ["rejeitarRevisao", rejeitarRevisao],
])("%s — entrada", (_nome, acao) => {
  it.each([
    ["id malformado", { id: "1 or 1=1" }],
    ["sem id", {}],
  ])("%s nunca chega ao banco", async (_caso, campos) => {
    expect(await acao(null, form(campos))).toMatchObject({ ok: false });
    expect(repo.getRevisaoById).not.toHaveBeenCalled();
    expect(banco.from).not.toHaveBeenCalled();
  });

  it("fora da produção, sem a liberação, o modo leitura recusa antes do banco", async () => {
    vi.stubEnv("ADMIN_ESCRITA_LIBERADA", "");

    expect(await acao(null, form({ id: ID }))).toMatchObject({ ok: false });
    expect(repo.getRevisaoById).not.toHaveBeenCalled();
    expect(banco.from).not.toHaveBeenCalled();
  });
});

describe("rejeitarRevisao", () => {
  it("leva a pendente a rejeitada, sem tocar em cafes", async () => {
    expect(await rejeitarRevisao(null, form({ id: ID }))).toEqual({
      ok: true,
      id: ID,
      status: "rejeitada",
    });
    expect(banco.updates).toEqual([
      {
        tabela: "revisoes",
        valores: { status: "rejeitada" },
        filtros: [
          ["eq", "id", ID],
          ["in", "status", ["pendente", "rejeitada"]],
        ],
      },
    ]);
  });

  it("é idempotente: rejeitar de novo (clique duplo, duas abas) também dá certo", async () => {
    expect(await rejeitarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: true,
    });
    expect(await rejeitarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: true,
    });
  });

  it("aprovada ou obsoleta não volta para rejeitada (o update não acha a linha)", async () => {
    banco.respostas.revisoes = { error: null, count: 0 };

    expect(await rejeitarRevisao(null, form({ id: ID }))).toMatchObject({
      ok: false,
    });
  });
});

describe("marcarRevisaoAprovada", () => {
  it("só marca a revisão pendente deste tipo e deste café", async () => {
    expect(await marcarRevisaoAprovada(ID, "atualizacao", CAFE_ID)).toBe(true);
    expect(banco.updates).toEqual([
      {
        tabela: "revisoes",
        valores: { status: "aprovada" },
        filtros: [
          ["eq", "id", ID],
          ["eq", "status", "pendente"],
          ["eq", "tipo", "atualizacao"],
          ["eq", "cafe_id", CAFE_ID],
        ],
      },
    ]);
  });

  it("no café novo, exige cafe_id nulo", async () => {
    await marcarRevisaoAprovada(ID, "cafe_novo", null);
    expect(banco.updates[0].filtros).toContainEqual(["is", "cafe_id", null]);
  });

  it("revisão de outro café ou já decidida (nenhuma linha muda) → false", async () => {
    banco.respostas.revisoes = { error: null, count: 0 };
    expect(await marcarRevisaoAprovada(ID, "atualizacao", CAFE_ID)).toBe(false);
  });
});

describe("aprovarRevisao — falhas no caminho", () => {
  it("café gravado mas a marcação não pega (outra aba decidiu): erro, sem dizer que aprovou", async () => {
    banco.respostas.revisoes = { error: null, count: 0 };

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({ ok: false, id: ID });
    expect(updatesEm("cafes")).toHaveLength(1);
  });

  it("café que não existe mais é erro, sem gravar", async () => {
    repo.getCafeById.mockResolvedValue(null);

    expect(await aprovarRevisao(null, form({ id: ID }))).toMatchObject({ ok: false });
    expect(banco.updates).toEqual([]);
  });
});
