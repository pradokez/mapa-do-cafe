// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { CafeDirectory } from "./cafe-directory";

// Fronteira com o Next: a URL do jsdom é a fonte dos params.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const CAFES = [cafe("a", { nome: "Café A", aceita_pets: true }), cafe("b", { nome: "Café B" })];

beforeEach(() => {
  // Viewport de celular: abaixo de `lg`.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  window.history.replaceState(null, "", "/?pets=true");
});
afterEach(cleanup);

describe("CafeDirectory — mobile", () => {
  it("abre na lista; o FAB alterna para o mapa e de volta, sem mexer nos filtros", async () => {
    render(<CafeDirectory cafes={CAFES} festivais={{}} />);

    expect(screen.getByText("1 café encontrado")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(screen.getByRole("button", { name: "Ver lista" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Ver lista" }));

    expect(screen.getByRole("button", { name: "Ver mapa" })).toBeDefined();
    expect(window.location.search).toBe("?pets=true");
    expect(screen.getByText("1 café encontrado")).toBeDefined();
  });
});

describe("CafeDirectory — festival", () => {
  it("o link com o filtro do festival filtra os participantes da edição no ar", () => {
    window.history.replaceState(null, "", "/?eu_amo_cafe=true");
    render(<CafeDirectory cafes={CAFES} festivais={{ "eu-amo-cafe": ["b"] }} />);

    expect(screen.getByText("1 café encontrado")).toBeDefined();
    expect(screen.getByRole("link", { name: "Café B" })).toBeDefined();
  });

  it("fora da edição, o mesmo link abre a home sem filtro, sem chip nem selo", () => {
    window.history.replaceState(null, "", "/?eu_amo_cafe=true&ascape=true");
    render(<CafeDirectory cafes={CAFES} festivais={{}} />);

    expect(screen.getByText("2 cafés encontrados")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Eu Amo Café" })).toBeNull();
    expect(screen.queryByText("Eu Amo Café")).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });
});
