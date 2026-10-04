/**
 * Ordem das fotos de um café no admin (#51). A primeira é a capa do card e
 * abre o carrossel. Puro: as Server Actions decidem a nova ordem aqui e só
 * gravam o resultado.
 */

export type Movimento = "subir" | "descer" | "capa";

export const MOVIMENTOS: readonly Movimento[] = ["subir", "descer", "capa"];

/**
 * Ids na nova ordem, ou `null` se não há o que mudar: foto que não é do café,
 * movimento desconhecido (vem do cliente), subir a capa, descer a última.
 */
export function moverFoto(ids: readonly string[], fotoId: string, movimento: Movimento): string[] | null {
  const i = ids.indexOf(fotoId);
  if (i < 0 || !MOVIMENTOS.includes(movimento)) return null;
  if (movimento === "capa") return i === 0 ? null : [fotoId, ...ids.filter((id) => id !== fotoId)];

  const j = movimento === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const nova = [...ids];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

type Ordem = { id: string; ordem: number };

/**
 * O que gravar para chegar a `novaOrdem`: `ordem` = posição (0…n-1), só nas
 * fotos em que muda. Buracos (de remoções) e empates (de uma gravação que
 * falhou no meio) somem na próxima vez — sempre converge, sem transação.
 */
export function ordensParaGravar(atuais: readonly Ordem[], novaOrdem: readonly string[]): Ordem[] {
  const ordemAtual = new Map(atuais.map((foto) => [foto.id, foto.ordem]));
  return novaOrdem.flatMap((id, ordem) => (ordemAtual.get(id) === ordem ? [] : [{ id, ordem }]));
}
