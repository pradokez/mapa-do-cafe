import { describe, expect, it } from "vitest";

import { enquadramentoFantasma, type Tela } from "./enquadramento-fantasma";

const SEM_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
const PADDING = { top: 72, right: 72, bottom: 32, left: 32 };

// Mapa da home desktop (55% de 1440 × a altura abaixo do header e dos chips).
const TELA: Tela = { largura: 800, altura: 600, padding: PADDING, maxZoom: 15 };

const GRACAS = { lat: -8.047, lng: -34.9 };
const BOA_VIAGEM = { lat: -8.13, lng: -34.9 };
const OLINDA = { lat: -8.01, lng: -34.85 };
const VARZEA = { lat: -8.05, lng: -34.95 };

/** De % para px na tela, para comparar com as bordas do padding. */
const emPx = ({ x, y }: { x: number; y: number }, tela: Tela = TELA) => ({
  x: (x / 100) * tela.largura,
  y: (y / 100) * tela.altura,
});

describe("enquadramentoFantasma", () => {
  it("um café → no centro da área útil, descontado o padding (como o Mapbox)", () => {
    const [p] = enquadramentoFantasma([GRACAS], [GRACAS], TELA);
    // 32 + (800 − 104) / 2 = 380; 72 + (600 − 104) / 2 = 320.
    expect(emPx(p).x).toBeCloseTo(380);
    expect(emPx(p).y).toBeCloseTo(320);
  });

  it("um café sem padding (o mini mapa) → no centro exato", () => {
    expect(enquadramentoFantasma([GRACAS], [GRACAS], { ...TELA, padding: SEM_PADDING })).toEqual([
      { x: 50, y: 50 },
    ]);
  });

  it("vários cafés → todos dentro da área útil, os extremos encostados nas bordas do padding", () => {
    const cafes = [GRACAS, BOA_VIAGEM, OLINDA, VARZEA];
    const pontos = enquadramentoFantasma(cafes, cafes, TELA).map((p) => emPx(p));
    expect(pontos).toHaveLength(4);
    for (const { x, y } of pontos) {
      expect(x).toBeGreaterThanOrEqual(32 - 1e-6);
      expect(x).toBeLessThanOrEqual(800 - 72 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(72 - 1e-6);
      expect(y).toBeLessThanOrEqual(600 - 32 + 1e-6);
    }
    // Mais alto que largo: a altura limita, e Olinda (norte) e Boa Viagem (sul) tocam o padding.
    const [, bv, olinda] = pontos;
    expect(olinda.y).toBeCloseTo(72);
    expect(bv.y).toBeCloseTo(600 - 32);
  });

  it("teto de zoom: cafés colados não se espalham até as bordas", () => {
    const vizinho = { lat: GRACAS.lat - 0.0002, lng: GRACAS.lng + 0.0002 }; // ~30 m
    const [a, b] = enquadramentoFantasma([GRACAS, vizinho], [GRACAS, vizinho], TELA).map((p) => emPx(p));
    // No zoom 15, 0,0002° dá ~9 px (512 · 2^15 · 0,0002 / 360); sem teto, seriam 496.
    expect(Math.abs(b.y - a.y)).toBeLessThan(30);
    expect(Math.abs(b.x - a.x)).toBeLessThan(30);
    // O par segue centrado na área útil.
    expect((a.x + b.x) / 2).toBeCloseTo(380);
    expect((a.y + b.y) / 2).toBeCloseTo(320, 0);
  });

  it("café sem coordenada válida fica de fora (não enquadra nem vira fantasma)", () => {
    const semCoordenada = { lat: Number.NaN, lng: -34.9 };
    const foraDoMundo = { lat: 120, lng: -34.9 };
    const pontos = enquadramentoFantasma(
      [GRACAS, semCoordenada, foraDoMundo],
      [semCoordenada, GRACAS, foraDoMundo],
      TELA,
    );
    expect(pontos.map((p) => emPx(p))).toEqual([{ x: expect.closeTo(380), y: expect.closeTo(320) }]);
  });

  it("nada a enquadrar ou a mostrar → nenhum fantasma", () => {
    expect(enquadramentoFantasma([], [GRACAS], TELA)).toEqual([]);
    expect(enquadramentoFantasma([GRACAS], [], TELA)).toEqual([]);
    expect(enquadramentoFantasma([{ lat: Number.NaN, lng: Number.NaN }], [GRACAS], TELA)).toEqual([]);
  });

  it("mapa sem área útil (ainda sem tamanho) → nenhum fantasma", () => {
    expect(enquadramentoFantasma([GRACAS], [GRACAS], { ...TELA, largura: 0, altura: 0 })).toEqual([]);
  });

  it("a proporção do mapa muda as posições, como no Mapbox", () => {
    const cafes = [GRACAS, BOA_VIAGEM, OLINDA, VARZEA];
    const alto = enquadramentoFantasma(cafes, cafes, { ...TELA, largura: 390, altura: 700 });
    const largo = enquadramentoFantasma(cafes, cafes, { ...TELA, largura: 1200, altura: 400 });
    expect(alto).not.toEqual(largo);
    // No largo, a altura limita: Olinda encosta no padding de cima; no alto (390 px), a largura limita.
    expect(emPx(largo[2], { ...TELA, largura: 1200, altura: 400 }).y).toBeCloseTo(72);
    expect(emPx(alto[3], { ...TELA, largura: 390, altura: 700 }).x).toBeCloseTo(32);
  });

  it("com o enquadramento aproximado (#96), café fora do mapa não vira fantasma", () => {
    const candeias = { lat: -8.2, lng: -34.92 };
    const pontos = enquadramentoFantasma([GRACAS, VARZEA], [GRACAS, candeias, VARZEA], TELA);
    expect(pontos).toHaveLength(2);
    expect(pontos.map((p) => emPx(p))[1].x).toBeCloseTo(32); // a Várzea, a oeste, na borda
  });
});
