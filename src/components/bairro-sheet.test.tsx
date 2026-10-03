// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";

import { BairroSheet } from "./bairro-sheet";

afterEach(cleanup);

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
  render(<BairroSheet cafes={CAFES} bairros={BAIRROS} filters={filters} onAplicar={onAplicar} />);
  return onAplicar;
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
});
