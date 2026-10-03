// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";

import { FiltrosSheet } from "./filtros-sheet";

afterEach(cleanup);

const CAFES = [
  cafe("a", { aceita_pets: true, faixa_preco: "$" }),
  cafe("b", { aceita_pets: true, faixa_preco: "$$" }),
  cafe("c", { faixa_preco: "$$$" }),
];

function renderSheet(filters: CafeFilters = FILTROS_VAZIOS) {
  const onAplicar = vi.fn();
  render(<FiltrosSheet cafes={CAFES} filters={filters} onAplicar={onAplicar} />);
  return onAplicar;
}

describe("FiltrosSheet", () => {
  it("sem filtro ativo, o botão não tem badge", () => {
    renderSheet();

    expect(screen.getByRole("button", { name: "Filtros" })).toBeDefined();
  });

  it("o badge conta cada filtro ativo, bairros inclusive, e não a busca", () => {
    renderSheet({ ...FILTROS_VAZIOS, pets: true, bairros: ["gracas", "pina"], precos: ["$"], q: "fiore" });

    const botao = screen.getByRole("button", { name: "Filtros, 4 ativos" });
    expect(botao.textContent).toContain("4");
  });

  it("marca atributos e faixas no rascunho, conta antes de fechar e aplica de uma vez", async () => {
    const onAplicar = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Aceita pets" }));
    expect(screen.getByRole("button", { name: "Ver 2 cafés" })).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Econômico" }));
    expect(onAplicar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(onAplicar).toHaveBeenCalledOnce();
    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, pets: true, precos: ["$"] });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("oferece o selo e os três atributos, mas não o bairro (que tem sheet próprio)", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

    const opcoes = screen.getAllByRole("checkbox").map((el) => el.textContent?.trim());
    expect(opcoes).toEqual([
      "Recife Coffee",
      "Aceita pets",
      "Tem estacionamento",
      "Permite coffee office",
      "$ Econômico",
      "$$ Moderado",
      "$$$ Elevado",
    ]);
  });

  it("Esc descarta o rascunho", async () => {
    const onAplicar = renderSheet({ ...FILTROS_VAZIOS, pets: true });
    await userEvent.click(screen.getByRole("button", { name: "Filtros, 1 ativo" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Aceita pets" }));
    await userEvent.keyboard("{Escape}");

    expect(onAplicar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Filtros, 1 ativo" }));
    expect(screen.getByRole("checkbox", { name: "Aceita pets" }).getAttribute("aria-checked")).toBe("true");
  });
});
