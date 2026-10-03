import { describe, expect, it } from "vitest";

import { placePreview } from "./map-preview-placement";

const MAP = { width: 800, height: 900 };

describe("placePreview", () => {
  it("pin no meio do mapa → preview acima do pin, centralizado nele", () => {
    expect(placePreview({ x: 400, y: 500 }, MAP)).toEqual({ placement: "above", left: 260, y: 446 });
  });

  it("pin no terço superior → preview abaixo do pin", () => {
    expect(placePreview({ x: 400, y: 120 }, MAP)).toEqual({ placement: "below", left: 260, y: 134 });
  });

  it("fronteira do terço: logo acima vira para baixo, exatamente nela fica acima", () => {
    expect(placePreview({ x: 400, y: 299.5 }, MAP).placement).toBe("below");
    expect(placePreview({ x: 400, y: 300 }, MAP).placement).toBe("above");
  });

  it("pin perto da borda esquerda → preview preso a 16 px dela", () => {
    expect(placePreview({ x: 30, y: 500 }, MAP).left).toBe(16);
  });

  it("pin perto da borda direita → preview termina a 16 px dela", () => {
    expect(placePreview({ x: 790, y: 500 }, MAP).left).toBe(800 - 280 - 16);
  });

  it("mapa mais estreito que o preview → alinha à esquerda em vez de sair pela borda", () => {
    expect(placePreview({ x: 150, y: 500 }, { width: 300, height: 900 }).left).toBe(16);
  });
});
