import type { Cafe, FaixaPreco } from "./cafe";

/** "1 café encontrado" / "N cafés encontrados" (microcopy fixado). */
export function contadorLabel(n: number): string {
  return n === 1 ? "1 café encontrado" : `${n} cafés encontrados`;
}

/**
 * Onde o café fica, para o card. Recife é o padrão e mostra só o bairro;
 * fora dele, a cidade entra junto ("Casa Caiada, Olinda").
 */
export function localLabel(cafe: Pick<Cafe, "bairro" | "cidade">): string {
  return cafe.cidade === "Recife" ? cafe.bairro : `${cafe.bairro}, ${cafe.cidade}`;
}

const NOMES_FAIXA_PRECO: Record<FaixaPreco, string> = {
  $: "Econômico",
  $$: "Moderado",
  $$$: "Especial",
};

/** Nome da faixa de preço (microcopy fixado): "$$" → "Moderado". */
export function faixaPrecoNome(faixa: FaixaPreco): string {
  return NOMES_FAIXA_PRECO[faixa];
}
