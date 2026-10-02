import { describe, expect, it } from "vitest";

import { contadorLabel, faixaPrecoNome, localLabel } from "./format";

describe("contadorLabel", () => {
  it.each([
    [0, "0 cafés encontrados"],
    [1, "1 café encontrado"],
    [2, "2 cafés encontrados"],
    [27, "27 cafés encontrados"],
  ])("%i → %s", (n, label) => {
    expect(contadorLabel(n)).toBe(label);
  });
});

describe("localLabel", () => {
  it("café do Recife mostra só o bairro", () => {
    expect(localLabel({ bairro: "Graças", cidade: "Recife" })).toBe("Graças");
  });

  it("café de Olinda mostra bairro e cidade", () => {
    expect(localLabel({ bairro: "Casa Caiada", cidade: "Olinda" })).toBe("Casa Caiada, Olinda");
  });
});

describe("faixaPrecoNome", () => {
  it.each([
    ["$", "Econômico"],
    ["$$", "Moderado"],
    ["$$$", "Especial"],
  ] as const)("%s → %s", (faixa, nome) => {
    expect(faixaPrecoNome(faixa)).toBe(nome);
  });
});
