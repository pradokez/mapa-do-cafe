/**
 * Conferência do trecho citado contra a página baixada (#178, PRD #167) —
 * sem React, sem Supabase, sem rede. É a defesa contra trecho e data
 * inventados pelo modelo: fonte cujo trecho não existe na página é descartada
 * antes de virar revisão.
 */

const ASPAS = /["'`´‘’‚‛“”„‟«»‹›]/g;
const TRAVESSOES = /[‐‑‒–—―−]/g;

/**
 * Sem acento, caixa, aspas, travessão nem diferença de espaço: "Café —
 * “Aberto”" e "cafe - aberto" ficam iguais. Só a forma muda; palavra trocada
 * continua diferente.
 */
export function normalizarTrecho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(ASPAS, "")
    .replace(TRAVESSOES, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** O trecho existe, inteiro e na mesma ordem, no texto da página? Paráfrase nunca. */
export function trechoExisteNaPagina(trecho: string, pagina: string): boolean {
  const procurado = normalizarTrecho(trecho);
  if (procurado === "") return false;
  return normalizarTrecho(pagina).includes(procurado);
}
