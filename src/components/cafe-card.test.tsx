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
