import type { Cafe, Cidade, FaixaPreco } from "./cafe";
import { isHttpUrl } from "./url";

/** "1 café encontrado" / "N cafés encontrados" (microcopy fixado). */
export function contadorLabel(n: number): string {
  return n === 1 ? "1 café encontrado" : `${n} cafés encontrados`;
}

/** "1 café" / "N cafés": total do painel do admin. */
export function totalDeCafes(n: number): string {
  return n === 1 ? "1 café" : `${n} cafés`;
}

/** Nome da cidade no card: "Jaboatão dos Guararapes" não cabe ao lado do bairro e da distância. */
const CIDADE_CURTA: Record<Exclude<Cidade, "Recife">, string> = {
  Olinda: "Olinda",
  "Jaboatão dos Guararapes": "Jaboatão",
};

/**
 * Onde o café fica, para o card. Recife é o padrão e mostra só o bairro;
 * fora dele, a cidade entra junto, pelo nome curto ("Candeias, Jaboatão").
 */
export function localLabel(cafe: Pick<Cafe, "bairro" | "cidade">): string {
  return cafe.cidade === "Recife" ? cafe.bairro : `${cafe.bairro}, ${CIDADE_CURTA[cafe.cidade]}`;
}

const NOMES_FAIXA_PRECO: Record<FaixaPreco, string> = {
  $: "Econômico",
  $$: "Moderado",
  $$$: "Elevado",
};

/** Nome da faixa de preço (microcopy fixado): "$$" → "Moderado". */
export function faixaPrecoNome(faixa: FaixaPreco): string {
  return NOMES_FAIXA_PRECO[faixa];
}

/** "Como chegar": busca do Google Maps (link comum, sem API nem chave). */
export function googleMapsUrl(cafe: Pick<Cafe, "nome" | "endereco" | "cidade">): string {
  const query = `${cafe.nome}, ${cafe.endereco}, ${cafe.cidade} - PE`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Link do Instagram, só se for URL http(s) — nunca `javascript:` vindo do banco. */
export function instagramUrl(cafe: Pick<Cafe, "instagram">): string | null {
  return isHttpUrl(cafe.instagram) ? cafe.instagram : null;
}
