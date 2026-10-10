// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Edicao, Participacao } from "@/lib/festival";

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

const pushState = window.history.pushState.bind(window.history);
const replaceState = window.history.replaceState.bind(window.history);
beforeEach(() => {
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
  vi.restoreAllMocks();
});

const CAFES = [
  cafe("a", { nome: "Kaffe", slug: "kaffe", aceita_pets: true }),
  cafe("b", { nome: "Versado", slug: "versado" }),
];

const participacao = (cafe_id: string, numero: number): Participacao => ({
  id: `p-${cafe_id}`,
  cafe_id,
  numero,
  nome_combo: null,
  alt: `Combo ${numero} de ${cafe_id}`,
  instagram_url: null,
  arte: null,
});

const EU_AMO_CAFE: Edicao = {
  id: "e1",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [participacao("b", 2), participacao("a", 1)],
};
const FESTIVAIS = { "eu-amo-cafe": ["a", "b"] };
/** Meio-dia em Recife, durante a edição. */
const DURANTE = new Date("2026-10-20T15:00:00Z");

const vitrine = () => screen.queryByRole("region", { name: "Combos do Eu Amo Café" });

describe("Vitrine do festival na home", () => {
  it("durante a edição e sem filtro, mostra os combos na ordem do número e leva à página", () => {
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: DURANTE }} />);

    const secao = vitrine()!;
    expect(within(secao).getByText("2 cafés participando · até 15 nov · R$ 34,90")).toBeDefined();
    expect(within(secao).getByRole("link", { name: "Ver todos" }).getAttribute("href")).toBe(
      "/festivais/eu-amo-cafe/2026",
    );
    expect(within(within(secao).getByRole("list")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Kaffe", "Versado"]);
  });

  it("antes do início, a vitrine já aparece, com a contagem no lugar do prazo", () => {
    const antes = new Date("2026-10-10T15:00:00Z");
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: antes }} />);
    expect(within(vitrine()!).getByText("2 cafés participando · começa em 8 dias · R$ 34,90")).toBeDefined();
  });

  it("sem edição no ar, não há vitrine", () => {
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [], agora: DURANTE }} />);
    expect(vitrine()).toBeNull();
  });

  it("sem nenhum participante na lista de cafés (saíram do ar), não há vitrine", () => {
    const foraDoAr = { ...EU_AMO_CAFE, participacoes: [participacao("z", 1)] };
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [foraDoAr], agora: DURANTE }} />);
    expect(vitrine()).toBeNull();
  });

  it.each(["/?pets=true", "/?q=kaffe", "/?eu_amo_cafe=true"])("com filtro ou busca (%s), a vitrine some", (url) => {
    replaceState(null, "", url);
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: DURANTE }} />);
    expect(vitrine()).toBeNull();
  });

  it("limpar os filtros traz a vitrine de volta", async () => {
    replaceState(null, "", "/?pets=true");
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: DURANTE }} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(vitrine()).not.toBeNull();
  });

  it("tocar numa arte a amplia, com \"Ver café\"; fechar devolve o foco ao combo", async () => {
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: DURANTE }} />);

    await userEvent.click(within(vitrine()!).getByRole("button", { name: /Versado/ }));
    const dialogo = screen.getByRole("dialog", { name: "Versado, combo 2 de 2" });
    expect(within(dialogo).getByRole("link", { name: "Ver café" }).getAttribute("href")).toBe("/cafes/versado");

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Kaffe, combo 1 de 2" })).toBeDefined();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(within(vitrine()!).getByRole("button", { name: /Kaffe/ }));
  });

  it("no desktop, as setas passam para o próximo conjunto e se apagam nas pontas", async () => {
    render(<CafeDirectory cafes={CAFES} festivais={FESTIVAIS} vitrines={{ edicoes: [EU_AMO_CAFE], agora: DURANTE }} />);
    const secao = vitrine()!;
    const fileira = within(secao).getByRole("list");
    // Sem layout no jsdom: 300 px à vista de 900.
    Object.defineProperty(fileira, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(fileira, "scrollWidth", { value: 900, configurable: true });
    const scrollBy = vi.fn();
    fileira.scrollBy = scrollBy;
    fireEvent.scroll(fileira);

    const anteriores = within(secao).getByRole("button", { name: "Combos anteriores" });
    const proximos = within(secao).getByRole("button", { name: "Próximos combos" });
    expect(anteriores.getAttribute("aria-disabled")).toBe("true");
    expect(proximos.getAttribute("aria-disabled")).toBe("false");

    await userEvent.click(proximos);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);

    fileira.scrollLeft = 600;
    fireEvent.scroll(fileira);
    expect(proximos.getAttribute("aria-disabled")).toBe("true");
    expect(anteriores.getAttribute("aria-disabled")).toBe("false");

    // Na ponta, a seta apagada não rola.
    scrollBy.mockClear();
    await userEvent.click(proximos);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
