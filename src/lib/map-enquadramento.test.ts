import { describe, expect, it } from "vitest";

import { distanciaKm } from "./cafe-distance";
import { circuloDoRaio, limitesDoRaio, pontosParaEnquadrar } from "./map-enquadramento";

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

describe("circuloDoRaio", () => {
  it("todo ponto do anel fica a km do centro", () => {
    for (const km of [1, 3, 7]) {
      for (const ponto of circuloDoRaio(GRACAS, km)) {
        expect(distanciaKm(GRACAS, ponto)).toBeCloseTo(km, 2);
      }
    }
  });

  it("o anel fecha: o último ponto repete o primeiro (polígono do GeoJSON)", () => {
    const anel = circuloDoRaio(GRACAS, 3);
    expect(anel.at(-1)).toEqual(anel[0]);
    expect(anel.length).toBeGreaterThan(32);
  });
});

describe("limitesDoRaio", () => {
  it("sudoeste e nordeste do círculo, simétricos em volta do centro", () => {
    const [so, ne] = limitesDoRaio(GRACAS, 3);
    expect(GRACAS.lat - so.lat).toBeCloseTo(ne.lat - GRACAS.lat, 9);
    expect(GRACAS.lng - so.lng).toBeCloseTo(ne.lng - GRACAS.lng, 9);
    expect(distanciaKm(GRACAS, { lat: ne.lat, lng: GRACAS.lng })).toBeCloseTo(3, 2);
    expect(distanciaKm(GRACAS, { lat: GRACAS.lat, lng: ne.lng })).toBeCloseTo(3, 2);
  });

  it("contém o anel inteiro", () => {
    const [so, ne] = limitesDoRaio(GRACAS, 7);
    for (const { lat, lng } of circuloDoRaio(GRACAS, 7)) {
      expect(lat).toBeGreaterThanOrEqual(so.lat - 1e-9);
      expect(lat).toBeLessThanOrEqual(ne.lat + 1e-9);
      expect(lng).toBeGreaterThanOrEqual(so.lng - 1e-9);
      expect(lng).toBeLessThanOrEqual(ne.lng + 1e-9);
    }
  });
});
