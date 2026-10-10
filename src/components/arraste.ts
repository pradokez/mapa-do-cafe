/**
 * Arraste horizontal dos carrosséis (detalhe e arte ampliada do festival).
 * Neutro: sem React, para o teste e os dois componentes.
 */

// Deslocamento horizontal mínimo para um toque contar como arraste.
const ARRASTE_PX = 40;

type Ponto = { x: number; y: number };

/**
 * Para onde o arraste de `de` até `ate` leva: `1` (próximo, dedo para a
 * esquerda), `-1` (anterior) ou `0` (curto demais, ou mais vertical que
 * horizontal — a página rolando).
 */
export function passoDoArraste(de: Ponto, ate: Ponto): -1 | 0 | 1 {
  const dx = ate.x - de.x;
  if (Math.abs(dx) <= ARRASTE_PX || Math.abs(dx) <= Math.abs(ate.y - de.y)) return 0;
  return dx < 0 ? 1 : -1;
}
