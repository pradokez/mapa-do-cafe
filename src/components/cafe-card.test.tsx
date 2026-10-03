// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { CafeCard } from "./cafe-card";

afterEach(cleanup);

describe("CafeCard — nome", () => {
  it("nome longo continua inteiro para leitor de tela e aparece no hover", () => {
    const nome = "O Melhor Cantinho de Café Especial da Cidade do Recife e Arredores";
    render(<CafeCard cafe={cafe("1", { nome })} />);

    const titulo = screen.getByRole("heading", { name: nome });
    expect(titulo.getAttribute("title")).toBe(nome);
  });
});

describe("CafeCard — selos e atributos", () => {
  it("mostra o selo Eu Amo Café junto do Recife Coffee", () => {
    render(<CafeCard cafe={cafe("1", { selo_ascape: true, selo_eu_amo_cafe: true })} />);

    expect(screen.getAllByText("Recife Coffee").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Eu Amo Café").length).toBeGreaterThan(0);
  });

  it("ar-condicionado só aparece quando é true: null (sem informação) some, como false", () => {
    const { rerender } = render(<CafeCard cafe={cafe("1", { tem_ar_condicionado: true })} />);
    expect(screen.queryByText("Ar-condicionado")).not.toBeNull();

    rerender(<CafeCard cafe={cafe("1", { tem_ar_condicionado: null })} />);
    expect(screen.queryByText("Ar-condicionado")).toBeNull();
  });
});
