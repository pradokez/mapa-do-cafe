// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Combo } from "@/lib/festival";

import { FestivalGrade } from "./festival-grade";

// Como o Next (≥ 14.1): `pushState` atualiza `useSearchParams` sem ida ao servidor.
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        (avisar) => {
          window.addEventListener("url", avisar);
          return () => window.removeEventListener("url", avisar);
        },
        () => window.location.search,
      ),
    ),
}));

const pushState = window.history.pushState.bind(window.history);
beforeEach(() => {
  window.history.replaceState(null, "", "/festivais/eu-amo-cafe/2026");
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new Event("url"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const combo = (id: string, numero: number, bairro: string, bairro_slug: string): Combo => ({
  participacao: { id: `p-${id}`, cafe_id: id, numero, nome_combo: null, alt: null, instagram_url: null, arte: null },
  cafe: cafe(id, { nome: `Café ${id}`, bairro, bairro_slug, endereco: `Rua ${id}, 1` }),
});

const COMBOS = [
  combo("A", 1, "Graças", "gracas"),
  combo("B", 2, "Boa Viagem", "boa-viagem"),
  combo("C", 3, "Graças", "gracas"),
];

function renderGrade() {
  render(<FestivalGrade combos={COMBOS} festival="Eu Amo Café" ano={2026} encerrada={false} />);
}

const nomesNaGrade = () =>
  within(screen.getAllByRole("list")[1])
    .getAllByRole("button")
    .map((b) => b.querySelector(".font-display")?.textContent);

describe("FestivalGrade", () => {
  it("lista todos os combos na ordem recebida, com o contador", () => {
    renderGrade();
    expect(nomesNaGrade()).toEqual(["Café A", "Café B", "Café C"]);
    expect(screen.getByRole("status").textContent).toBe("3 combos");
  });

  it("o chip de bairro filtra a grade e põe o bairro na URL; Todos limpa", async () => {
    renderGrade();
    await userEvent.click(screen.getByRole("link", { name: "Graças" }));

    expect(window.location.search).toBe("?bairro=gracas");
    expect(nomesNaGrade()).toEqual(["Café A", "Café C"]);
    expect(screen.getByRole("link", { name: "Graças" }).getAttribute("aria-current")).toBe("true");

    await userEvent.click(screen.getByRole("link", { name: "Todos" }));
    expect(window.location.search).toBe("");
    expect(nomesNaGrade()).toEqual(["Café A", "Café B", "Café C"]);
  });

  it("o link compartilhado abre filtrado; bairro desconhecido é ignorado", () => {
    window.history.replaceState(null, "", "/festivais/eu-amo-cafe/2026?bairro=boa-viagem");
    renderGrade();
    expect(nomesNaGrade()).toEqual(["Café B"]);
    expect(screen.getByRole("status").textContent).toBe("1 combo");
    cleanup();

    window.history.replaceState(null, "", "/festivais/eu-amo-cafe/2026?bairro=espinheiro");
    renderGrade();
    expect(nomesNaGrade()).toEqual(["Café A", "Café B", "Café C"]);
  });

  it("cada chip é um link de verdade, para o filtro funcionar sem JavaScript", () => {
    renderGrade();
    expect(screen.getByRole("link", { name: "Boa Viagem" }).getAttribute("href")).toBe(
      "/festivais/eu-amo-cafe/2026?bairro=boa-viagem",
    );
  });

  it("a arte ampliada passa os combos pelas setas, com volta nas pontas, e devolve o foco ao combo à vista", async () => {
    renderGrade();
    await userEvent.click(screen.getByRole("button", { name: /Café B/ }));

    const dialogo = () => screen.getByRole("dialog");
    expect(dialogo().getAttribute("aria-labelledby")).toBeTruthy();
    expect(within(dialogo()).getByRole("heading").textContent).toBe("Café B, combo 2 de 3");

    await userEvent.click(within(dialogo()).getByRole("button", { name: "Próximo combo" }));
    expect(within(dialogo()).getByRole("heading").textContent).toBe("Café C, combo 3 de 3");

    await userEvent.keyboard("{ArrowRight}");
    expect(within(dialogo()).getByRole("heading").textContent).toBe("Café A, combo 1 de 3");

    await userEvent.keyboard("{ArrowLeft}");
    expect(within(dialogo()).getByRole("heading").textContent).toBe("Café C, combo 3 de 3");

    expect(within(dialogo()).getByRole("link", { name: "Ver café" }).getAttribute("href")).toBe("/cafes/C");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement?.textContent).toContain("Café C");
  });
});
