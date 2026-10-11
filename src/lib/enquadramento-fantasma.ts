/**
 * Posições dos pins-fantasma (#142, PRD #135): onde os pins vão aparecer quando
 * o Mapbox terminar de carregar — sem React, sem Mapbox (regra 1). Reproduz o
 * `fitBounds` do `mapbox-gl` em Web Mercator com mundo de 512 px: o zoom que
 * cabe os limites na área útil (a tela menos o padding), com teto, e o centro
 * dos limites no centro da área útil (o padding vira o do mapa).
 */

import type { Coordenadas } from "./cafe-distance";

export type Padding = { top: number; right: number; bottom: number; left: number };

/** O mapa como o Mapbox vai enquadrá-lo: tamanho em px, `FIT_PADDING` e `MAX_ZOOM`. */
export type Tela = { largura: number; altura: number; padding: Padding; maxZoom: number };

/** Posição na tela, em % da largura e da altura do mapa. */
export type PosicaoNaTela = { x: number; y: number };

const MUNDO = 512;
// Além disso, a Web Mercator vai ao infinito; o Mapbox também corta aí.
const LAT_MAXIMA = 85.051129;

const valida = ({ lat, lng }: Coordenadas) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= LAT_MAXIMA && Math.abs(lng) <= 180;

/** Coordenada → ponto no mundo de 1 × 1 (o x cresce para leste, o y para o sul). */
function mercator({ lat, lng }: Coordenadas) {
  const seno = Math.sin((lat * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI) };
}

/**
 * Onde cada ponto de `mostrar` cai no mapa enquadrado em `enquadrar` — os
 * cafés filtrados, ou a posição e os mais perto (`pontosParaEnquadrar`, #96).
 * Na ordem de `mostrar`, só os que caem dentro do mapa. Coordenada inválida
 * fica de fora dos dois; nada válido, ou mapa ainda sem área útil, → `[]`.
 */
export function enquadramentoFantasma(
  enquadrar: readonly Coordenadas[],
  mostrar: readonly Coordenadas[],
  { largura, altura, padding, maxZoom }: Tela,
): PosicaoNaTela[] {
  const util = {
    largura: largura - padding.left - padding.right,
    altura: altura - padding.top - padding.bottom,
  };
  const limites = enquadrar.filter(valida).map(mercator);
  if (limites.length === 0 || util.largura <= 0 || util.altura <= 0) return [];

  const xs = limites.map((p) => p.x);
  const ys = limites.map((p) => p.y);
  const [oeste, leste, norte, sul] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  // px por unidade do mundo 1 × 1. Um ponto só (limites sem tamanho) → o teto.
  const escala = Math.min(
    util.largura / (leste - oeste),
    util.altura / (sul - norte),
    MUNDO * 2 ** maxZoom,
  );
  const centro = { x: (oeste + leste) / 2, y: (norte + sul) / 2 };
  const meio = { x: padding.left + util.largura / 2, y: padding.top + util.altura / 2 };

  return mostrar
    .filter(valida)
    .map(mercator)
    .map((p) => ({ x: meio.x + (p.x - centro.x) * escala, y: meio.y + (p.y - centro.y) * escala }))
    .filter(({ x, y }) => x >= 0 && x <= largura && y >= 0 && y <= altura)
    .map(({ x, y }) => ({ x: (x / largura) * 100, y: (y / altura) * 100 }));
}
