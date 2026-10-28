// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DecisaoDeRevisao, Revisao } from "@/lib/revisao";

/**
 * Depois de decidir (#182): quando a lista revalidada chega, o foco vai às
 * ações do mesmo item ou do vizinho, e o `role="status"` diz o que houve. A
 * resposta da action é dublada: `estados` faz o papel do `useFormState`.
 */

const acoes = vi.hoisted(() => ({
  aprovarRevisao: vi.fn(),
  rejeitarRevisao: vi.fn(),
}));
vi.mock("@/lib/admin/revisoes-actions", () => acoes);
const estados = vi.hoisted(() => ({
  aprovar: null as DecisaoDeRevisao,
  rejeitar: null as DecisaoDeRevisao,
}));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormState: (acao: unknown) => [acao === acoes.aprovarRevisao ? estados.aprovar : estados.rejeitar, vi.fn()],
  useFormStatus: () => ({ pending: false }),
}));

import { ListaDeRevisoes } from "./lista-de-revisoes";

const AGORA = new Date("2026-10-28T12:00:00Z");

const revisao = (id: string, cafe_id: string): Revisao => ({
  id,
  tipo: "atualizacao",
  cafe_id,
  campo: "telefone",
  valor_atual: "(81) 3071-6834",
  valor_proposto: "(81) 99908-4986",
  fontes: [],
  atualidade: "atualizada",
  status: "pendente",
  criado_em: "2026-10-20T12:00:00Z",
  decidido_em: null,
  cafe: { nome: `Café ${id}`, slug: id, ativo: true },
  nome_proposto: null,
});

const R1 = revisao("r1", "c1");
const R2 = revisao("r2", "c2");
const lista = (revisoes: Revisao[]) => <ListaDeRevisoes revisoes={revisoes} agora={AGORA} total={revisoes.length} />;
/** O botão `nome` das ações da revisão `id`. */
const acaoDe = (id: string, nome: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-revisao="${id}"] [data-acoes] button`)).find(
    (b) => b.textContent === nome,
  )!;

beforeEach(() => {
  estados.aprovar = null;
  estados.rejeitar = null;
});
afterEach(cleanup);

describe("foco e anúncio depois da decisão", () => {
  it("aprovada sai da lista: foco no vizinho e 'Revisão aprovada.'", () => {
    const { rerender } = render(lista([R1, R2]));
    fireEvent.submit(acaoDe("r1", "Aprovar").closest("form")!);

    estados.aprovar = { ok: true, id: "r1", status: "aprovada" };
    rerender(lista([R2]));

    expect(document.activeElement?.textContent).toBe("Aprovar");
    expect(document.activeElement?.closest("[data-revisao]")?.getAttribute("data-revisao")).toBe("r2");
    expect(screen.getByRole("status").textContent).toBe("Revisão aprovada.");
  });

  it("até a lista nova chegar, nada muda de lugar", () => {
    const { rerender } = render(lista([R1, R2]));
    fireEvent.submit(acaoDe("r1", "Aprovar").closest("form")!);

    estados.aprovar = { ok: true, id: "r1", status: "obsoleta" };
    rerender(lista([R1, R2]));
    expect(screen.getByRole("status").textContent).toBe("");

    rerender(lista([R2]));
    expect(screen.getByRole("status").textContent).toBe(
      "O café mudou desde a coleta: a revisão ficou obsoleta e nada foi gravado.",
    );
  });

  it("a última rejeitada: foco no aviso de fila vazia", () => {
    const { rerender } = render(lista([R1]));
    fireEvent.submit(acaoDe("r1", "Rejeitar").closest("form")!);

    estados.rejeitar = { ok: true, id: "r1", status: "rejeitada" };
    rerender(lista([]));

    expect(document.activeElement?.textContent).toBe("Nada por aqui com esse filtro.");
    expect(screen.getByRole("status").textContent).toBe("Revisão rejeitada.");
  });

  it("erro fica no item que o recebeu", () => {
    estados.aprovar = {
      ok: false,
      id: "r2",
      erro: "Esta revisão já foi decidida.",
    };
    render(lista([R1, R2]));

    const alerta = screen.getByText("Esta revisão já foi decidida.");
    expect(alerta.closest("[data-revisao]")?.getAttribute("data-revisao")).toBe("r2");
  });
});
