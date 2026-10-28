import { describe, expect, it } from "vitest";

import { trechoExisteNaPagina } from "./revisao-fontes";

const PAGINA = `Café do Bairro — Graças
Funcionamos de terça a domingo, das 8h às 18h.
Segunda-feira: “fechado para descanso”.
Aceitamos pets na varanda.`;

describe("trechoExisteNaPagina", () => {
  it("acha o trecho exato", () => {
    expect(trechoExisteNaPagina("Aceitamos pets na varanda.", PAGINA)).toBe(true);
  });

  it("tolera espaços a mais ou a menos", () => {
    expect(trechoExisteNaPagina("  Funcionamos   de terça   a domingo,  das 8h  ", PAGINA)).toBe(true);
  });

  it("tolera quebra de linha no lugar de espaço", () => {
    expect(trechoExisteNaPagina("das 8h às 18h. Segunda-feira:", PAGINA)).toBe(true);
    expect(trechoExisteNaPagina("Funcionamos de terça\na domingo", PAGINA)).toBe(true);
  });

  it("tolera caixa diferente", () => {
    expect(trechoExisteNaPagina("ACEITAMOS PETS NA VARANDA", PAGINA)).toBe(true);
  });

  it("tolera acento diferente", () => {
    expect(trechoExisteNaPagina("Funcionamos de terca a domingo, das 8h as 18h", PAGINA)).toBe(true);
    expect(trechoExisteNaPagina("cafe do bairro", "CAFÉ DO BAIRRO")).toBe(true);
  });

  it("tolera aspas e travessão diferentes", () => {
    expect(trechoExisteNaPagina('Segunda-feira: "fechado para descanso"', PAGINA)).toBe(true);
    expect(trechoExisteNaPagina("Segunda-feira: 'fechado para descanso'", PAGINA)).toBe(true);
    expect(trechoExisteNaPagina("Segunda-feira: fechado para descanso", PAGINA)).toBe(true);
    expect(trechoExisteNaPagina("Café do Bairro - Graças", PAGINA)).toBe(true);
  });

  it("não aceita paráfrase", () => {
    expect(trechoExisteNaPagina("Abre de terça a domingo, das 8h às 18h.", PAGINA)).toBe(false);
    expect(trechoExisteNaPagina("Pets são bem-vindos na varanda.", PAGINA)).toBe(false);
  });

  it("não aceita trecho com uma parte real e outra inventada", () => {
    expect(trechoExisteNaPagina("Aceitamos pets na varanda e no salão.", PAGINA)).toBe(false);
    expect(trechoExisteNaPagina("Funcionamos de segunda a domingo, das 8h às 18h.", PAGINA)).toBe(false);
  });

  it("não aceita trechos reais fora de ordem", () => {
    expect(trechoExisteNaPagina("Aceitamos pets na varanda. Funcionamos de terça a domingo", PAGINA)).toBe(false);
  });

  it("página vazia não tem trecho nenhum", () => {
    expect(trechoExisteNaPagina("Aceitamos pets na varanda.", "")).toBe(false);
    expect(trechoExisteNaPagina("Aceitamos pets na varanda.", "   \n ")).toBe(false);
  });

  it("trecho vazio não prova nada", () => {
    expect(trechoExisteNaPagina("", PAGINA)).toBe(false);
    expect(trechoExisteNaPagina(" “” ", PAGINA)).toBe(false);
  });
});
