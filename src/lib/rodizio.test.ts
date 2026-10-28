import { describe, expect, it } from "vitest";

import { GRUPOS_DO_RODIZIO, rodizio } from "./rodizio";

const cafes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `cafe-${String(i).padStart(3, "0")}` }));

// Segunda 2026-10-26 (Recife), mais 1 semana por passo.
const segunda = (semanas: number) => new Date(Date.UTC(2026, 9, 26 + 7 * semanas, 15));
const ids = (lista: { id: string }[]) => lista.map((c) => c.id);

describe("rodizio", () => {
  it("lista vazia devolve vazio", () => {
    expect(rodizio([], segunda(0))).toEqual([]);
  });

  it("todo café ativo cai em exatamente uma das 4 semanas do ciclo", () => {
    const lista = cafes(51);
    const vistos = [0, 1, 2, 3].flatMap((s) => ids(rodizio(lista, segunda(s))));
    expect(vistos.sort()).toEqual(ids(lista).sort());
  });

  it("os grupos têm tamanho parecido (no máximo 1 de diferença)", () => {
    const tamanhos = [0, 1, 2, 3].map((s) => rodizio(cafes(51), segunda(s)).length);
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(1);
  });

  it("cada grupo volta a cada 4 semanas", () => {
    const lista = cafes(23);
    for (const s of [0, 1, 2, 3]) {
      expect(ids(rodizio(lista, segunda(s + 4)))).toEqual(ids(rodizio(lista, segunda(s))));
      expect(ids(rodizio(lista, segunda(s + 40)))).toEqual(ids(rodizio(lista, segunda(s))));
    }
  });

  it("o ciclo não quebra na virada do ano (semana ISO 53 → 1)", () => {
    const lista = cafes(12);
    const anterior = new Date(Date.UTC(2026, 11, 28, 15)); // segunda, semana 53
    const seguinte = new Date(Date.UTC(2027, 0, 4, 15)); // segunda, semana 1
    const depois = new Date(Date.UTC(2027, 0, 11, 15));
    const g = (d: Date) => ids(rodizio(lista, d));
    expect(g(anterior)).not.toEqual(g(seguinte));
    expect(g(seguinte)).not.toEqual(g(depois));
    // 4 semanas depois de 2026-12-28 é 2027-01-25
    expect(g(new Date(Date.UTC(2027, 0, 25, 15)))).toEqual(g(anterior));
  });

  it("a semana vai de segunda a domingo", () => {
    const lista = cafes(8);
    const semana = ids(rodizio(lista, segunda(0)));
    for (let dia = 0; dia < 7; dia++) {
      expect(ids(rodizio(lista, new Date(Date.UTC(2026, 9, 26 + dia, 15))))).toEqual(semana);
    }
    expect(ids(rodizio(lista, segunda(1)))).not.toEqual(semana);
  });

  it("a semana vira à meia-noite de Recife, não à do UTC", () => {
    const lista = cafes(8);
    const domingoNoite = new Date("2026-11-02T02:59:00Z"); // domingo 23:59 em Recife (UTC-3)
    const segundaCedo = new Date("2026-11-02T03:00:00Z"); // segunda 00:00 em Recife
    expect(ids(rodizio(lista, domingoNoite))).toEqual(ids(rodizio(lista, segunda(0))));
    expect(ids(rodizio(lista, segundaCedo))).toEqual(ids(rodizio(lista, segunda(1))));
  });

  it("a ordem de entrada não muda os grupos", () => {
    const lista = cafes(20);
    const embaralhada = [...lista].reverse();
    for (const s of [0, 1, 2, 3]) {
      expect(ids(rodizio(embaralhada, segunda(s)))).toEqual(ids(rodizio(lista, segunda(s))));
    }
  });

  it("devolve o próprio café, com os outros campos", () => {
    const lista = [{ id: "a", nome: "A" }];
    const todos = [0, 1, 2, 3].flatMap((s) => rodizio(lista, segunda(s)));
    expect(todos).toEqual([{ id: "a", nome: "A" }]);
  });

  it("café novo desloca poucos cafés: os grupos seguem equilibrados", () => {
    const antes = cafes(40);
    const depois = [...antes, { id: "cafe-0205" }];
    const tamanhos = [0, 1, 2, 3].map((s) => rodizio(depois, segunda(s)).length);
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(1);
    expect(GRUPOS_DO_RODIZIO).toBe(4);
  });
});
