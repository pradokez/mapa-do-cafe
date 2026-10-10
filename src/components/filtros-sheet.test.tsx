// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import { FILTROS_VAZIOS, type CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

import { FiltrosSheet } from "./filtros-sheet";

afterEach(cleanup);

const CAFES = [
  cafe("a", { aceita_pets: true, faixa_preco: "$" }),
  cafe("b", { aceita_pets: true, faixa_preco: "$$" }),
  cafe("c", { faixa_preco: "$$$" }),
];

const OS_DOIS_NO_AR: FestivaisNoAr = { "recife-coffee": ["c"], "eu-amo-cafe": ["a", "c"] };

function renderSheet(filters: CafeFilters = FILTROS_VAZIOS, festivais: FestivaisNoAr = OS_DOIS_NO_AR) {
  const onAplicar = vi.fn();
  render(<FiltrosSheet cafes={CAFES} festivais={festivais} filters={filters} onAplicar={onAplicar} />);
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
    await userEvent.click(screen.getByRole("button", { name: "Aceita pets" }));
    expect(screen.getByRole("button", { name: "Aceita pets" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Ver 2 cafés" })).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Econômico" }));
    expect(onAplicar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(onAplicar).toHaveBeenCalledOnce();
    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, pets: true, precos: ["$"] });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("organiza em seções: selos e comodidades em chips, faixa de preço em linhas; sem bairro (que tem sheet próprio)", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

    const chips = (secao: string) =>
      within(screen.getByRole("group", { name: secao }))
        .getAllByRole("button")
        .map((el) => el.getAttribute("aria-label"));
    expect(chips("Selos")).toEqual(["Recife Coffee", "Eu Amo Café"]);
    expect(chips("Comodidades")).toEqual([
      "Aceita pets",
      "Tem estacionamento",
      "Permite coffee office",
      "Acessível para PcD",
      "Opções vegetarianas",
      "Ar-condicionado",
    ]);
    const faixas = within(screen.getByRole("group", { name: "Faixa de preço" }))
      .getAllByRole("checkbox")
      .map((el) => el.textContent?.trim());
    expect(faixas).toEqual(["$ Econômico", "$$ Moderado", "$$$ Elevado"]);
  });

  it("o chip do festival filtra os participantes da edição e conta no badge", async () => {
    const onAplicar = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Eu Amo Café" }));
    await userEvent.click(screen.getByRole("button", { name: "Aceita pets" }));

    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));
    expect(onAplicar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, euAmoCafe: true, pets: true });

    cleanup();
    renderSheet({ ...FILTROS_VAZIOS, euAmoCafe: true });
    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeDefined();
  });

  it("só o festival no ar aparece em Selos; sem nenhum no ar, a seção some", async () => {
    renderSheet(FILTROS_VAZIOS, { "eu-amo-cafe": [] });
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(
      within(screen.getByRole("group", { name: "Selos" }))
        .getAllByRole("button")
        .map((el) => el.getAttribute("aria-label")),
    ).toEqual(["Eu Amo Café"]);

    cleanup();
    renderSheet(FILTROS_VAZIOS, {});
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.queryByRole("group", { name: "Selos" })).toBeNull();
    expect(screen.getByRole("group", { name: "Comodidades" })).toBeDefined();
  });

  it("Esc descarta o rascunho", async () => {
    const onAplicar = renderSheet({ ...FILTROS_VAZIOS, pets: true });
    await userEvent.click(screen.getByRole("button", { name: "Filtros, 1 ativo" }));
    await userEvent.click(screen.getByRole("button", { name: "Aceita pets" }));
    await userEvent.keyboard("{Escape}");

    expect(onAplicar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Filtros, 1 ativo" }));
    expect(screen.getByRole("button", { name: "Aceita pets" }).getAttribute("aria-pressed")).toBe("true");
  });
});
