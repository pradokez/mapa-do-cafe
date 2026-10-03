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
    render(<CafeDirectory cafes={CAFES} />);

    expect(screen.getByText("1 café encontrado")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(screen.getByRole("button", { name: "Ver lista" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Ver lista" }));

    expect(screen.getByRole("button", { name: "Ver mapa" })).toBeDefined();
    expect(window.location.search).toBe("?pets=true");
    expect(screen.getByText("1 café encontrado")).toBeDefined();
  });
});
