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

// Sem posição: a ordem é a alfabética do repositório.
const geo: GeoState = { status: "denied", coords: null };
vi.mock("@/hooks/use-geolocation", () => ({ useGeolocation: () => geo }));

const pushState = window.history.pushState.bind(window.history);
const replaceState = window.history.replaceState.bind(window.history);
beforeEach(() => {
  // A barra rola o chip focado para dentro; o jsdom não implementa scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  replaceState(null, "", "/");
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new Event("url"));
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const todoDia = (turno: string) => ({
  segunda: turno,
  terca: turno,
  quarta: turno,
  quinta: turno,
  sexta: turno,
  sabado: turno,
  domingo: turno,
});
const CAFES = [
  cafe("manha", { nome: "Manhã", slug: "manha", horario_funcionamento: todoDia("08:00 – 12:00"), tem_estacionamento: true }),
  cafe("tarde", { nome: "Tarde", slug: "tarde", horario_funcionamento: todoDia("14:00 – 18:00"), tem_estacionamento: true }),
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
    { id: "p1", cafe_id: "manha", numero: 1, nome_combo: null, alt: "Combo 1", instagram_url: null, arte: null },
  ],
};
// Quarta, 28/10/2026, em Recife (UTC−3): o request às 10h; o clique, às 15h.
const DEZ_HORAS = new Date("2026-10-28T13:00:00Z");
const QUINZE_HORAS = new Date("2026-10-28T18:00:00Z");

function renderHome() {
  return render(
    <CafeDirectory cafes={CAFES} festivais={{ "eu-amo-cafe": ["manha"] }} vitrines={[EDICAO]} agora={DEZ_HORAS} />,
  );
}

const nomes = () =>
  screen.getAllByRole("article").map((card) => within(card).getAllByRole("link")[0].textContent);
const vitrine = () => screen.queryByRole("region", { name: "Combos do Eu Amo Café" });
const chip = () => screen.getByRole("button", { name: "Aberto agora" });

/** O relógio do navegador já passou do instante do request. */
const passarPara = (instante: Date) => vi.useFakeTimers({ toFake: ["Date"], now: instante });

describe("Filtro Aberto agora", () => {
  it("link com aberto_agora=true já sai filtrado pelo instante do request", () => {
    replaceState(null, "", "/?aberto_agora=true");
    passarPara(QUINZE_HORAS);
    renderHome();

    expect(nomes()).toEqual(["Manhã"]);
    expect(chip().getAttribute("aria-pressed")).toBe("true");
  });

  it("a lista não muda sozinha com a página aberta", () => {
    replaceState(null, "", "/?aberto_agora=true");
    const { rerender } = renderHome();
    passarPara(QUINZE_HORAS);

    rerender(<CafeDirectory cafes={CAFES} festivais={{ "eu-amo-cafe": ["manha"] }} vitrines={[EDICAO]} agora={DEZ_HORAS} />);

    expect(nomes()).toEqual(["Manhã"]);
  });

  it("ligar o chip usa o relógio do clique e escreve na URL", async () => {
    renderHome();
    expect(nomes()).toEqual(["Manhã", "Tarde"]);
    passarPara(QUINZE_HORAS);

    await userEvent.click(chip());

    expect(nomes()).toEqual(["Tarde"]);
    expect(window.location.search).toBe("?aberto_agora=true");
  });

  it("religar ou mudar outro filtro com ele ligado também usa a hora atual", async () => {
    replaceState(null, "", "/?aberto_agora=true");
    renderHome();
    passarPara(QUINZE_HORAS);

    await userEvent.click(screen.getByRole("button", { name: "Tem estacionamento" }));
    expect(nomes()).toEqual(["Tarde"]);

    await userEvent.click(chip());
    expect(nomes()).toEqual(["Manhã", "Tarde"]);
  });

  it("conta no badge, esconde a vitrine e sai com \"Limpar filtros\"", async () => {
    renderHome();
    expect(vitrine()).not.toBeNull();

    await userEvent.click(chip());

    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeDefined();
    expect(vitrine()).toBeNull();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(nomes()).toEqual(["Manhã", "Tarde"]);
    expect(chip().getAttribute("aria-pressed")).toBe("false");
    expect(vitrine()).not.toBeNull();
  });

  it("no sheet de filtros, conta e aplica com o instante em que o sheet abriu", async () => {
    renderHome();
    passarPara(QUINZE_HORAS);

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const horario = within(screen.getByRole("dialog")).getByRole("group", { name: "Horário" });
    await userEvent.click(within(horario).getByRole("button", { name: "Aberto agora" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver 1 café" }));

    expect(nomes()).toEqual(["Tarde"]);
    expect(window.location.search).toBe("?aberto_agora=true");
  });
});
