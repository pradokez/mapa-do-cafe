// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MapaDePosicao } from "./mapa-de-posicao";

afterEach(cleanup);

// Sem IntersectionObserver (jsdom), o mapa não monta: o teste fica na legenda.
describe("MapaDePosicao", () => {
  it("sem posição válida ainda, explica onde o ponto vai aparecer", () => {
    render(<MapaDePosicao lat="" lng="-34,92" />);
    expect(screen.getByText("O ponto aparece aqui quando latitude e longitude estiverem preenchidas.")).toBeTruthy();
  });

  it("com posição na região, pede para conferir o pin", () => {
    render(<MapaDePosicao lat="-8,03" lng="-34,92" />);
    expect(screen.getByText("Confira se o pin está no lugar do café.")).toBeTruthy();
  });

  it("digitando (ou fora da região), o pin fica na última posição válida e a legenda avisa", () => {
    const { rerender } = render(<MapaDePosicao lat="-8,03" lng="-34,92" />);
    rerender(<MapaDePosicao lat="-8,03" lng="-3" />);
    expect(screen.getByText(/o pin mostra a última posição válida/)).toBeTruthy();

    rerender(<MapaDePosicao lat="-34,92" lng="-8,03" />);
    expect(screen.getByText(/o pin mostra a última posição válida/)).toBeTruthy();
  });
});
