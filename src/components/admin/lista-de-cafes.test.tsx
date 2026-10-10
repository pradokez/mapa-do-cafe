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

  it("busca só com espaços conta como sem busca", () => {
    render(<ListaDeCafes cafes={CAFES} q="   " />);

    expect(nomesNaTabela()).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Limpar busca" })).toBeNull();
  });

  it("com várias palavras, cada uma precisa casar com o nome ou o bairro", () => {
    render(<ListaDeCafes cafes={CAFES} q="borsoi pina" />);

    expect(nomesNaTabela()).toEqual(["Borsoi Café"]);
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

  it("fotos temporárias (#92): a contagem aparece na tabela e no card, e some quando é zero", () => {
    const fotos = (n: number) => Array.from({ length: n }, (_, i) => `f${i}.webp`);
    const cafes = [{ ...CAFES[0], fotos: fotos(3) }, { ...CAFES[1], fotos: fotos(2) }, { ...CAFES[2], fotos: fotos(1) }];
    render(<ListaDeCafes cafes={cafes} q="" temporarias={{ [cafes[0].id]: 1, [cafes[1].id]: 2 }} />);

    const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(linhas[0].textContent).toContain("3 · 1 temporária");
    expect(linhas[1].textContent).toContain("2 · 2 temporárias");
    expect(linhas[2].textContent).not.toContain("temporária");

    const cards = screen.getAllByRole("listitem");
    expect(cards[0].textContent).toContain("3 fotos · 1 temporária");
    expect(cards[2].textContent).toContain("1 foto");
    expect(cards[2].textContent).not.toContain("temporária");
  });
});
