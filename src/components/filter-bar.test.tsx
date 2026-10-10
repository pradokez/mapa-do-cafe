// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

import { FilterBar } from "./filter-bar";

// A barra rola o chip focado para dentro; o jsdom não implementa scrollIntoView.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const OS_DOIS_NO_AR: FestivaisNoAr = { "recife-coffee": [], "eu-amo-cafe": [] };

function renderBar(filters: CafeFilters = FILTROS_VAZIOS, festivais: FestivaisNoAr = OS_DOIS_NO_AR) {
  const onToggle = vi.fn();
  render(
    <FilterBar
      cafes={[]}
      festivais={festivais}
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

const chipsDaBarra = () =>
  within(screen.getByRole("group", { name: "Filtros" }))
    .getAllByRole("button", { pressed: false })
    .map((el) => el.getAttribute("aria-label"));

describe("FilterBar", () => {
  it("a barra mostra os festivais no ar e o estacionamento; o resto fica em Mais filtros", () => {
    renderBar();

    expect(chipsDaBarra()).toEqual(["Recife Coffee", "Eu Amo Café", "Tem estacionamento", "Econômico", "Moderado", "Elevado"]);
    expect(screen.queryByRole("button", { name: "Aceita pets" })).toBeNull();
  });

  it("só o festival no ar tem chip; sem nenhum no ar, a barra começa no estacionamento", () => {
    renderBar(FILTROS_VAZIOS, { "eu-amo-cafe": [] });
    expect(chipsDaBarra()).toEqual(["Eu Amo Café", "Tem estacionamento", "Econômico", "Moderado", "Elevado"]);

    cleanup();
    renderBar(FILTROS_VAZIOS, {});
    expect(chipsDaBarra()).toEqual(["Tem estacionamento", "Econômico", "Moderado", "Elevado"]);
  });

  it("o chip do festival liga o filtro dele", async () => {
    const onToggle = renderBar(FILTROS_VAZIOS, { "eu-amo-cafe": [] });
    await userEvent.click(screen.getByRole("button", { name: "Eu Amo Café" }));

    expect(onToggle).toHaveBeenCalledWith("euAmoCafe");
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
    renderBar({ ...FILTROS_VAZIOS, euAmoCafe: true, pcd: true, arCondicionado: true });

    expect(screen.getByRole("button", { name: "Mais filtros, 2 ativos" }).textContent).toContain("2");
  });
});
