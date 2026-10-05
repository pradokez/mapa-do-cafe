import { describe, expect, it } from "vitest";

import { contadorLabel, faixaPrecoNome, googleMapsUrl, instagramUrl, localLabel, totalDeCafes } from "./format";

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

describe("totalDeCafes", () => {
  it.each([
    [0, "0 cafés"],
    [1, "1 café"],
    [53, "53 cafés"],
  ])("%i → %s", (n, label) => {
    expect(totalDeCafes(n)).toBe(label);
  });
});

describe("localLabel", () => {
  it("café do Recife mostra só o bairro", () => {
    expect(localLabel({ bairro: "Graças", cidade: "Recife" })).toBe("Graças");
  });

  it("café de Olinda mostra bairro e cidade", () => {
    expect(localLabel({ bairro: "Casa Caiada", cidade: "Olinda" })).toBe("Casa Caiada, Olinda");
  });

  it("café de Jaboatão dos Guararapes mostra a cidade pelo nome curto, que cabe no card", () => {
    expect(localLabel({ bairro: "Candeias", cidade: "Jaboatão dos Guararapes" })).toBe("Candeias, Jaboatão");
  });
});

describe("faixaPrecoNome", () => {
  it.each([
    ["$", "Econômico"],
    ["$$", "Moderado"],
    ["$$$", "Elevado"],
  ] as const)("%s → %s", (faixa, nome) => {
    expect(faixaPrecoNome(faixa)).toBe(nome);
  });
});

describe("googleMapsUrl", () => {
  it("busca o café pelo nome, endereço e cidade no Google Maps", () => {
    const url = new URL(
      googleMapsUrl({ nome: "Café & Cia", endereco: "R. da Hora, 100", cidade: "Olinda" }),
    );

    expect(`${url.origin}${url.pathname}`).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Café & Cia, R. da Hora, 100, Olinda - PE");
  });
});

describe("instagramUrl", () => {
  it("devolve a URL do perfil", () => {
    const instagram = "https://www.instagram.com/cafecomdengo/";

    expect(instagramUrl({ instagram })).toBe(instagram);
  });

  it.each([
    ["nulo", null],
    ["vazio", ""],
    ["sem protocolo", "instagram.com/cafe"],
    ["javascript:", "javascript:alert(1)"],
  ])("%s → sem link", (_, instagram) => {
    expect(instagramUrl({ instagram })).toBeNull();
  });
});
