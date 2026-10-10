// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";

import { BairroSheet } from "./bairro-sheet";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const CAFES = [
  cafe("a", { bairro: "Graças", bairro_slug: "gracas" }),
  cafe("b", { bairro: "Espinheiro", bairro_slug: "espinheiro" }),
  cafe("c", { bairro: "Espinheiro", bairro_slug: "espinheiro" }),
];
const BAIRROS = [
  { slug: "espinheiro", nome: "Espinheiro" },
  { slug: "gracas", nome: "Graças" },
];

function renderSheet(filters: CafeFilters = FILTROS_VAZIOS) {
  const onAplicar = vi.fn();
  render(<BairroSheet cafes={CAFES} festivais={{}} bairros={BAIRROS} filters={filters} onAplicar={onAplicar} />);
  return onAplicar;
}

/**
 * Arrasta de `de` até `ate` (clientY) em `ms` milissegundos. O jsdom não tem
 * layout: o sheet é simulado com 600 px de altura.
 */
function arrastar(
  el: Element,
  de: number,
  ate: number,
  ms: number,
  { pausa = 0, fim = "pointerUp" }: { pausa?: number; fim?: "pointerUp" | "pointerCancel" } = {},
) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 600 } as DOMRect);
  vi.useFakeTimers({ toFake: ["performance"] });
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientY: de });
  vi.advanceTimersByTime(ms / 2);
  fireEvent.pointerMove(el, { pointerId: 1, clientY: (de + ate) / 2 });
  vi.advanceTimersByTime(ms / 2);
  fireEvent.pointerMove(el, { pointerId: 1, clientY: ate });
  // Dedo parado antes de soltar.
  vi.advanceTimersByTime(pausa);
  fireEvent[fim](el, { pointerId: 1, clientY: ate });
  vi.useRealTimers();
}

describe("BairroSheet", () => {
  it("o botão conta o rascunho antes de fechar, e só ele aplica", async () => {
    const onAplicar = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

    expect(screen.getByRole("dialog", { name: "Bairro" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Ver 3 cafés" })).toBeDefined();

    await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));
    expect(screen.getByRole("checkbox", { name: "Graças" }).getAttribute("aria-checked")).toBe("true");
    expect(onAplicar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("checkbox", { name: "Espinheiro" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver 3 cafés" }));

    expect(onAplicar).toHaveBeenCalledOnce();
    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, bairros: ["gracas", "espinheiro"] });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("contagem no singular com um café só", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Bairro" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));

    expect(screen.getByRole("button", { name: "Ver 1 café" })).toBeDefined();
  });

  it("Esc descarta o rascunho e devolve o foco ao chip", async () => {
    const onAplicar = renderSheet();
    const gatilho = screen.getByRole("button", { name: "Bairro" });
    await userEvent.click(gatilho);
    await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onAplicar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(gatilho);

    await userEvent.click(gatilho);
    expect(screen.getByRole("checkbox", { name: "Graças" }).getAttribute("aria-checked")).toBe("false");
  });

  it("\"Todos os bairros\" limpa a seleção do rascunho", async () => {
    const onAplicar = renderSheet({ ...FILTROS_VAZIOS, bairros: ["gracas"] });
    await userEvent.click(screen.getByRole("button", { name: "Bairro: Graças" }));

    expect(screen.getByRole("checkbox", { name: "Todos os bairros" }).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByRole("checkbox", { name: "Todos os bairros" }));

    expect(screen.getByRole("checkbox", { name: "Todos os bairros" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Graças" }).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Ver 3 cafés" }));
    expect(onAplicar).toHaveBeenCalledWith(FILTROS_VAZIOS);
  });

  it("o rascunho parte dos filtros em vigor, inclusive os de fora do sheet", async () => {
    const onAplicar = renderSheet({ ...FILTROS_VAZIOS, pets: true });
    await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

    // Nenhum café do recorte aceita pets.
    expect(screen.getByRole("button", { name: "Ver 0 cafés" })).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver 0 cafés" }));

    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, pets: true, bairros: ["gracas"] });
  });

  it("busca que chega com o sheet aberto (debounce) não é desfeita ao aplicar", async () => {
    const onAplicar = vi.fn();
    const props = { cafes: CAFES, festivais: {}, bairros: BAIRROS, onAplicar };
    const { rerender } = render(<BairroSheet {...props} filters={FILTROS_VAZIOS} />);
    await userEvent.click(screen.getByRole("button", { name: "Bairro" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));

    rerender(<BairroSheet {...props} filters={{ ...FILTROS_VAZIOS, q: "zzz" }} />);

    expect(screen.getByRole("button", { name: "Ver 0 cafés" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Ver 0 cafés" }));
    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, q: "zzz", bairros: ["gracas"] });
  });

  describe("arrastar para baixo", () => {
    it("pelo título, além do limiar, descarta o rascunho e devolve o foco ao chip", async () => {
      const onAplicar = renderSheet();
      const gatilho = screen.getByRole("button", { name: "Bairro" });
      await userEvent.click(gatilho);
      await userEvent.click(screen.getByRole("checkbox", { name: "Graças" }));

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 400, 1000);

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onAplicar).not.toHaveBeenCalled();
      await waitFor(() => expect(document.activeElement).toBe(gatilho));

      await userEvent.click(gatilho);
      expect(screen.getByRole("checkbox", { name: "Graças" }).getAttribute("aria-checked")).toBe("false");
    });

    it("depois de fechar arrastando, reabre inteiro e arrastável de novo", async () => {
      renderSheet();
      const gatilho = screen.getByRole("button", { name: "Bairro" });
      await userEvent.click(gatilho);
      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 400, 1000);
      await waitFor(() => expect(document.activeElement).toBe(gatilho));

      await userEvent.click(gatilho);
      expect(screen.getByRole("dialog", { name: "Bairro" }).style.transform).toBe("");

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 400, 1000);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("um arrasto interrompido por Esc não trava o próximo", async () => {
      renderSheet();
      const gatilho = screen.getByRole("button", { name: "Bairro" });
      await userEvent.click(gatilho);
      fireEvent.pointerDown(screen.getByRole("heading", { name: "Bairro" }), { pointerId: 7, button: 0, clientY: 100 });
      await userEvent.keyboard("{Escape}");

      await userEvent.click(gatilho);
      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 400, 1000);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("curto e lento, o sheet volta à posição", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 180, 1000);

      expect(screen.getByRole("dialog", { name: "Bairro" })).toBeDefined();
    });

    it("curto mas rápido (um peteleco), fecha", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 180, 80);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("um peteleco seguido de pausa com o dedo parado não fecha", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 180, 80, { pausa: 500 });

      expect(screen.getByRole("dialog", { name: "Bairro" })).toBeDefined();
    });

    it("cancelado pelo navegador, não fecha nem com arrasto longo", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

      arrastar(screen.getByRole("heading", { name: "Bairro" }), 100, 400, 1000, { fim: "pointerCancel" });

      expect(screen.getByRole("dialog", { name: "Bairro" })).toBeDefined();
    });

    it("começando na lista, não fecha: ali o gesto é rolar", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Bairro" }));

      arrastar(screen.getByRole("checkbox", { name: "Graças" }), 100, 400, 80);

      expect(screen.getByRole("dialog", { name: "Bairro" })).toBeDefined();
    });
  });
});
