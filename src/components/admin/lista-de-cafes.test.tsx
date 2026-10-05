// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { ListaDeCafes } from "./lista-de-cafes";

afterEach(cleanup);

const CAFES = [
  cafe("borsoi", { nome: "Borsoi Café", bairro: "Pina", bairro_slug: "pina" }),
  cafe("castigliani", { nome: "Castigliani", bairro: "Graças", ativo: false }),
  cafe("saltim", { nome: "Saltim", bairro: "Espinheiro", bairro_slug: "espinheiro" }),
];

/** Nomes que aparecem na tabela do desktop (os cards do mobile repetem os mesmos). */
function nomesNaTabela() {
  const tabela = screen.queryByRole("table");
  if (!tabela) return [];
  return within(tabela)
    .getAllByRole("link", { name: /borsoi|castigliani|saltim/i })
    .map((link) => link.textContent);
}

describe("ListaDeCafes", () => {
  it("sem busca, mostra todos os cafés e não oferece limpar", () => {
    render(<ListaDeCafes cafes={CAFES} q="" />);

    expect(nomesNaTabela()).toEqual(["Borsoi Café", "Castigliani", "Saltim"]);
    expect(screen.queryByRole("link", { name: "Limpar busca" })).toBeNull();
  });

  it("com busca, mostra só os que casam por nome ou bairro, inclusive os fora do ar", () => {
    render(<ListaDeCafes cafes={CAFES} q="GRACAS" />);

    expect(nomesNaTabela()).toEqual(["Castigliani"]);
    expect(screen.getByText("1 de 3 cafés")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Limpar busca" }).getAttribute("href")).toBe("/admin");
  });

  it("busca sem resultado diz isso, sem lista, e oferece limpar", () => {
    render(<ListaDeCafes cafes={CAFES} q="moka" />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/nenhum café/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Limpar busca" }).getAttribute("href")).toBe("/admin");
  });

  it("o campo, com rótulo, envia ?q= por GET e vem com a busca atual", () => {
    render(<ListaDeCafes cafes={CAFES} q="pina" />);

    const campo = screen.getByRole("searchbox", { name: "Buscar café" }) as HTMLInputElement;
    expect(campo.name).toBe("q");
    expect(campo.value).toBe("pina");
    const form = campo.closest("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/admin");
  });
});
