/**
 * Rodízio de verificação do robô de curadoria (#179, PRD #167): a cada semana,
 * um quarto dos cafés ativos, para que cada café seja revisto uma vez por mês.
 * Puro e determinístico: sem relógio, sem sorteio.
 */

import { hojeEmRecife } from "./foto-upload";

export const GRUPOS_DO_RODIZIO = 4;

const MS_POR_DIA = 86_400_000;
// 1970-01-01 foi quinta; a primeira segunda-feira (dia 4) abre a semana 0.
const PRIMEIRA_SEGUNDA = 4;

/**
 * Número da semana (segunda a domingo) desde 1970, no dia de `America/Recife`.
 * Contínuo: a semana ISO do ano reinicia em janeiro e quebraria o ciclo de 4.
 */
export function semanaDeRecife(agora: Date): number {
  const [ano, mes, dia] = hojeEmRecife(agora).split("-").map(Number);
  const dias = Math.floor(Date.UTC(ano, mes - 1, dia) / MS_POR_DIA);
  return Math.floor((dias - PRIMEIRA_SEGUNDA) / 7);
}

/**
 * Os cafés da semana de `agora`. Ordenados por `id` e distribuídos em 4 grupos
 * alternados (o 1º, o 5º, o 9º… no grupo 0): todo café cai em exatamente um
 * grupo e os tamanhos diferem em no máximo 1, então café novo nunca
 * desequilibra. Em troca, um `id` novo no meio da ordem muda o grupo dos que
 * vêm depois dele — no pior caso, um café é revisto duas vezes no mês ou
 * espera mais um.
 */
export function rodizio<T extends { id: string }>(cafes: readonly T[], agora: Date): T[] {
  const grupo = ((semanaDeRecife(agora) % GRUPOS_DO_RODIZIO) + GRUPOS_DO_RODIZIO) % GRUPOS_DO_RODIZIO;
  return [...cafes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((_, i) => i % GRUPOS_DO_RODIZIO === grupo);
}
