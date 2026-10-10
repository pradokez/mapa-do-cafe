import { describe, expect, it } from "vitest";

import { passoDoArraste } from "./arraste";

describe("passoDoArraste", () => {
  const de = { x: 200, y: 300 };

  it("dedo para a esquerda vai ao próximo; para a direita, ao anterior", () => {
    expect(passoDoArraste(de, { x: 120, y: 305 })).toBe(1);
    expect(passoDoArraste(de, { x: 280, y: 295 })).toBe(-1);
  });

  it("até 40 px não conta", () => {
    expect(passoDoArraste(de, { x: 160, y: 300 })).toBe(0);
    expect(passoDoArraste(de, { x: 159, y: 300 })).toBe(1);
  });

  it("mais vertical que horizontal é a página rolando, não arraste", () => {
    expect(passoDoArraste(de, { x: 120, y: 400 })).toBe(0);
  });
});
