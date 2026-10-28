import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Revisao } from "./revisao";

/**
 * Leituras da fila de revisões (#177). O client é um dublê gravador: guarda a
 * consulta que o repositório monta e devolve a resposta combinada.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <F>(fn: F) => fn }));

const banco = vi.hoisted(() => ({
  resposta: { data: [] as unknown, count: 0, error: null as { message: string } | null },
  consultas: [] as { tabela: string; chamadas: [string, unknown[]][] }[],
}));

vi.mock("@/lib/supabase-server", () => ({
  createAnonClient: () => ({}),
  createSessionClient: () => ({
    from: (tabela: string) => {
      const consulta = { tabela, chamadas: [] as [string, unknown[]][] };
      banco.consultas.push(consulta);
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_, nome: string) => {
            if (nome === "then") {
              return (resolve: (valor: unknown) => unknown) => resolve(banco.resposta);
            }
            return (...args: unknown[]) => {
              consulta.chamadas.push([nome, args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  }),
}));

import { contarRevisoes, getRevisaoById, LIMITE_DE_REVISOES, listRevisoes, ultimaRodada } from "./cafe-repository";

const linha = (p: Partial<Revisao>) => ({
  id: "00000000-0000-4000-8000-000000000001",
  tipo: "atualizacao",
  cafe_id: "c1",
  campo: "telefone",
  valor_atual: null,
  valor_proposto: "(81) 3071-6834",
  fontes: [],
  atualidade: "atualizada",
  status: "pendente",
  criado_em: "2026-10-20T12:00:00Z",
  decidido_em: null,
  cafe: { nome: "Café A", slug: "cafe-a", ativo: true },
  ...p,
});

beforeEach(() => {
  banco.consultas = [];
  banco.resposta = { data: [], count: 0, error: null };
});

describe("listRevisoes", () => {
  it("filtra pelos status, pega as mais recentes e respeita o teto", async () => {
    await listRevisoes(["pendente", "obsoleta"]);
    const { tabela, chamadas } = banco.consultas[0];
    expect(tabela).toBe("revisoes");
    expect(chamadas).toContainEqual(["in", ["status", ["pendente", "obsoleta"]]]);
    expect(chamadas).toContainEqual(["order", ["criado_em", { ascending: false }]]);
    expect(chamadas).toContainEqual(["limit", [LIMITE_DE_REVISOES]]);
  });

  it("devolve fechamento, café novo e atualização, nessa ordem", async () => {
    banco.resposta.data = [
      linha({ id: "00000000-0000-4000-8000-00000000000a" }),
      linha({ id: "00000000-0000-4000-8000-00000000000b", tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null, valor_proposto: { nome: "Novo Café" } }),
      linha({ id: "00000000-0000-4000-8000-00000000000c", tipo: "fechamento", campo: null }),
    ];
    const lista = await listRevisoes(["pendente"]);
    expect(lista.map((r) => r.tipo)).toEqual(["fechamento", "cafe_novo", "atualizacao"]);
  });

  it("café novo ganha o nome da proposta; os outros tipos, não", async () => {
    banco.resposta.data = [
      linha({ tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null, valor_proposto: { nome: "Novo Café" } }),
      linha({ id: "00000000-0000-4000-8000-000000000002" }),
    ];
    const [novo, atualizacao] = await listRevisoes(["pendente"]);
    expect(novo.nome_proposto).toBe("Novo Café");
    expect(atualizacao.nome_proposto).toBeNull();
  });

  it("erro do banco lança", async () => {
    banco.resposta.error = { message: "boom" };
    await expect(listRevisoes(["pendente"])).rejects.toThrow("Falha ao listar as revisões");
  });
});

describe("getRevisaoById", () => {
  it("id malformado nem chega ao banco", async () => {
    expect(await getRevisaoById("nao-e-uuid")).toBeNull();
    expect(banco.consultas).toHaveLength(0);
  });

  it("inexistente → null", async () => {
    banco.resposta.data = null;
    expect(await getRevisaoById("00000000-0000-4000-8000-000000000001")).toBeNull();
  });
});

describe("contarRevisoes", () => {
  it("uma contagem por status", async () => {
    banco.resposta.count = 3;
    expect(await contarRevisoes()).toEqual({ pendente: 3, aprovada: 3, rejeitada: 3, obsoleta: 3 });
    expect(banco.consultas.map((c) => c.chamadas.find(([n]) => n === "eq")?.[1])).toEqual([
      ["status", "pendente"],
      ["status", "aprovada"],
      ["status", "rejeitada"],
      ["status", "obsoleta"],
    ]);
  });
});

describe("ultimaRodada", () => {
  it("pede a mais recente", async () => {
    banco.resposta.data = { id: "r", inicio: "2026-10-27T10:00:00Z" };
    expect(await ultimaRodada()).toMatchObject({ id: "r" });
    expect(banco.consultas[0].chamadas).toContainEqual(["order", ["inicio", { ascending: false }]]);
  });

  it("sem nenhuma rodada → null", async () => {
    banco.resposta.data = null;
    expect(await ultimaRodada()).toBeNull();
  });
});
