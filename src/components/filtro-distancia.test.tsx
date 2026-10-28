// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeoState } from "@/hooks/use-geolocation";
import { cafe } from "@/lib/cafe.fixture";
import type { Edicao } from "@/lib/festival";

import { CafeDirectory } from "./cafe-directory";

// Como o Next (≥ 14.1): `pushState` atualiza `useSearchParams` sem ida ao servidor.
vi.mock("next/navigation", () => ({
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

// Posição dublada: o Marco Zero. Sem posição, o hook real em `distancia-sem-posicao.test.tsx`.
const MARCO_ZERO = { lat: -8.0631, lng: -34.8711 };
let geo: GeoState;
vi.mock("@/hooks/use-geolocation", () => ({ useGeolocation: () => geo }));

const pushState = window.history.pushState.bind(window.history);
const replaceState = window.history.replaceState.bind(window.history);
let push: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // A barra rola o chip focado para dentro; o jsdom não implementa scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  geo = { status: "granted", coords: MARCO_ZERO, tentando: false };
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  replaceState(null, "", "/");
  push = vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new Event("url"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Ao norte do Marco Zero: ~0,6 km e ~5,5 km.
const CAFES = [
  cafe("longe", { nome: "Longe", slug: "longe", lat: -8.0131, lng: -34.8711, aceita_pets: true }),
  cafe("perto", { nome: "Perto", slug: "perto", lat: -8.0581, lng: -34.8711 }),
];

const EDICAO: Edicao = {
  id: "e1",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [
    { id: "p1", cafe_id: "perto", numero: 1, nome_combo: null, alt: "Combo 1", instagram_url: null, arte: null },
  ],
};
const DURANTE = new Date("2026-10-20T15:00:00Z");

function renderHome() {
  render(
    <CafeDirectory
      cafes={CAFES}
      festivais={{ "eu-amo-cafe": ["perto"] }}
      vitrines={[EDICAO]} agora={DURANTE}
    />,
  );
}

const nomes = () =>
  screen.getAllByRole("article").map((card) => within(card).getAllByRole("link")[0].textContent);
const vitrine = () => screen.queryByRole("region", { name: "Combos do Eu Amo Café" });

/** Os dois chips de distância: o do mobile abre o sheet; o do desktop, o menu. */
const chip = (nome: string, abre: "dialog" | "menu") =>
  screen.getAllByRole("button", { name: nome }).find((el) => el.getAttribute("aria-haspopup") === abre)!;
const chipDoSheet = (nome: string) => chip(nome, "dialog");
const chipDoMenu = (nome: string) => chip(nome, "menu");

async function escolherNoSheet(opcao: string) {
  await userEvent.click(chipDoSheet("Distância"));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: opcao }));
}

describe("Filtro de distância — com posição", () => {
  it("\"Até 1 km\" no sheet corta a lista e não muda a URL nem o histórico", async () => {
    renderHome();
    expect(nomes()).toEqual(["Perto", "Longe"]);

    await escolherNoSheet("Até 1 km");
    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(nomes()).toEqual(["Perto"]);
    expect(screen.getByText("1 café encontrado")).toBeDefined();
    expect(window.location.search).toBe("");
    expect(push).not.toHaveBeenCalled();
    expect(chipDoSheet("Distância: Até 1 km")).toBeDefined();
  });

  it("no desktop, o menu aplica na hora, com o raio no rótulo do chip", async () => {
    renderHome();

    await userEvent.click(chipDoMenu("Distância"));
    expect(screen.getAllByRole("menuitemradio").map((el) => el.textContent)).toEqual([
      "Qualquer distância",
      "Até 1 km",
      "Até 3 km",
      "Até 7 km",
    ]);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Até 1 km" }));

    expect(nomes()).toEqual(["Perto"]);
    expect(window.location.search).toBe("");
    expect(chipDoMenu("Distância: Até 1 km").textContent).toBe("Até 1 km");

    await userEvent.click(chipDoMenu("Distância: Até 1 km"));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Qualquer distância" }));
    expect(nomes()).toEqual(["Perto", "Longe"]);
  });

  it("escolher só o raio não reescreve a URL, nem com um param velho nela", async () => {
    replaceState(null, "", "/?ascape=true");
    renderHome();

    await userEvent.click(chipDoMenu("Distância"));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Até 1 km" }));

    expect(nomes()).toEqual(["Perto"]);
    expect(window.location.search).toBe("?ascape=true");
    expect(push).not.toHaveBeenCalled();
  });

  it("combina com os outros filtros e com a busca; sem café no raio, o estado vazio de sempre", async () => {
    replaceState(null, "", "/?pets=true");
    renderHome();
    expect(nomes()).toEqual(["Longe"]);

    await escolherNoSheet("Até 1 km");
    await userEvent.click(screen.getByRole("button", { name: "Ver 0 cafés" }));

    expect(screen.getByText("Xícara vazia por aqui")).toBeDefined();
    expect(window.location.search).toBe("?pets=true");
  });

  it("o badge conta o raio, a vitrine some, e \"Limpar filtros\" desliga tudo", async () => {
    renderHome();
    expect(vitrine()).not.toBeNull();

    await escolherNoSheet("Até 1 km");
    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeDefined();
    expect(vitrine()).toBeNull();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(nomes()).toEqual(["Perto", "Longe"]);
    expect(screen.getByRole("button", { name: "Filtros" })).toBeDefined();
    expect(vitrine()).not.toBeNull();
  });

  it("no sheet de filtros, o raio é rascunho: Esc descarta, \"Ver N cafés\" aplica", async () => {
    renderHome();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const secao = within(screen.getByRole("dialog")).getByRole("group", { name: "Distância" });
    await userEvent.click(within(secao).getByRole("radio", { name: "Até 1 km" }));
    expect(screen.getByRole("button", { name: "Ver 1 café" })).toBeDefined();
    await userEvent.keyboard("{Escape}");

    expect(nomes()).toEqual(["Perto", "Longe"]);

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const reaberta = within(screen.getByRole("dialog")).getByRole("group", { name: "Distância" });
    expect(within(reaberta).getByRole("radio", { name: "Qualquer distância" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(within(reaberta).getByRole("radio", { name: "Até 1 km" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(nomes()).toEqual(["Perto"]);
    expect(push).not.toHaveBeenCalled();
  });

  it("as setas andam e marcam no grupo de raios", async () => {
    renderHome();
    await userEvent.click(chipDoSheet("Distância"));
    const radio = (nome: string) => within(screen.getByRole("dialog")).getByRole("radio", { name: nome });

    radio("Qualquer distância").focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(radio("Até 1 km").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("Até 1 km"));
    expect(radio("Até 3 km").tabIndex).toBe(-1);
  });

  it("mudar outro filtro mantém o raio", async () => {
    renderHome();
    await escolherNoSheet("Até 7 km");
    await userEvent.click(screen.getByRole("button", { name: "Ver 2 cafés" }));

    await userEvent.click(screen.getByRole("button", { name: "Filtros, 1 ativo" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceita pets" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(window.location.search).toBe("?pets=true");
    expect(screen.getByRole("button", { name: "Filtros, 2 ativos" })).toBeDefined();
  });
});
