import { describe, expect, it } from "vitest";

import { compararPorNome } from "./cafe";

describe("compararPorNome", () => {
  it("ordena alfabeticamente em pt-BR, ignorando caixa e acento", () => {
    const nomes = ["Xêro Café e Arte", "Café Jardim", "Água Viva", "Café com Dengo", "81 Coffee Co.", "Aurora Café"];

    expect(nomes.map((nome) => ({ nome })).sort(compararPorNome).map((c) => c.nome)).toEqual([
      "81 Coffee Co.",
      "Água Viva",
      "Aurora Café",
      "Café com Dengo",
      "Café Jardim",
      "Xêro Café e Arte",
    ]);
  });
});
