import { describe, expect, it } from "vitest";

import { pontosParaEnquadrar } from "./map-enquadramento";

const GRACAS = { lat: -8.047, lng: -34.9 };

// Do mais perto ao mais longe das Graças, fora de ordem na entrada.
const LONGE = { id: "longe", lat: -8.17, lng: -34.92 }; // Candeias
const PERTO = { id: "perto", lat: -8.048, lng: -34.9 };
const MEDIO = { id: "medio", lat: -8.06, lng: -34.9 };
const PERTO_2 = { id: "perto-2", lat: -8.05, lng: -34.9 };
const CAFES = [LONGE, MEDIO, PERTO_2, PERTO];

describe("pontosParaEnquadrar", () => {
  it("dentro da região → a posição e os 3 cafés mais perto dela", () => {
    expect(pontosParaEnquadrar(CAFES, GRACAS)).toEqual([GRACAS, PERTO, PERTO_2, MEDIO]);
  });

  it("sem posição (negada, indisponível ou não decidida) → nada a enquadrar", () => {
    expect(pontosParaEnquadrar(CAFES, null)).toBeNull();
  });

  it("fora de Recife, Olinda e Jaboatão → nada a enquadrar, mesmo com cafés", () => {
    expect(pontosParaEnquadrar(CAFES, { lat: -23.55, lng: -46.63 })).toBeNull(); // São Paulo
    expect(pontosParaEnquadrar(CAFES, { lat: -8.28, lng: -35.0 })).toBeNull(); // Cabo, logo ao sul
  });

  it("menos de 3 cafés → a posição e os que houver", () => {
    expect(pontosParaEnquadrar([LONGE, PERTO], GRACAS)).toEqual([GRACAS, PERTO, LONGE]);
  });

  it("café sem coordenada válida não entra: o enquadramento sempre mostra café de verdade", () => {
    const semCoordenada = { id: "sem", lat: Number.NaN, lng: -34.9 };
    expect(pontosParaEnquadrar([semCoordenada, PERTO], GRACAS)).toEqual([GRACAS, PERTO]);
  });

  it("nenhum café para mostrar → nada a enquadrar (não aproxima num mapa vazio)", () => {
    expect(pontosParaEnquadrar([], GRACAS)).toBeNull();
    expect(pontosParaEnquadrar([{ lat: Number.NaN, lng: Number.NaN }], GRACAS)).toBeNull();
  });
});
