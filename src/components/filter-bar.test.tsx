// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";

import { FilterBar } from "./filter-bar";

// A barra rola o chip focado para dentro; o jsdom não implementa scrollIntoView.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function renderBar(filters: CafeFilters = FILTROS_VAZIOS) {
  const onToggle = vi.fn();
  render(
    <FilterBar
      cafes={[]}
      filters={filters}
      bairros={[]}
      onToggle={onToggle}
      onToggleBairro={vi.fn()}
      onLimparBairros={vi.fn()}
      onTogglePreco={vi.fn()}
      onAplicar={vi.fn()}
    />,
  );
  return onToggle;
}

describe("FilterBar", () => {
  it("a barra mostra os selos e o estacionamento; o resto fica em Mais filtros", () => {
    renderBar();

    const chips = within(screen.getByRole("group", { name: "Filtros" }))
      .getAllByRole("button", { pressed: false })
      .map((el) => el.getAttribute("aria-label"));
    expect(chips).toEqual(["Recife Coffee", "Eu Amo Café", "Tem estacionamento", "Econômico", "Moderado", "Elevado"]);
    expect(screen.queryByRole("button", { name: "Aceita pets" })).toBeNull();
  });

  it("Mais filtros oferece os outros atributos e liga o marcado", async () => {
    const onToggle = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Mais filtros" }));

    const opcoes = screen.getAllByRole("menuitemcheckbox").map((el) => el.textContent?.trim());
    expect(opcoes).toEqual([
      "Aceita pets",
      "Permite coffee office",
      "Acessível para PcD",
      "Opções vegetarianas",
      "Ar-condicionado",
    ]);
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Acessível para PcD" }));

    expect(onToggle).toHaveBeenCalledWith("pcd");
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("Mais filtros conta só os filtros dele que estão ligados", () => {
    renderBar({ ...FILTROS_VAZIOS, ascape: true, pcd: true, arCondicionado: true });

    expect(screen.getByRole("button", { name: "Mais filtros, 2 ativos" }).textContent).toContain("2");
  });
});
