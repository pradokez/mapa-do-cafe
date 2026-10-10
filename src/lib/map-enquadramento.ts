/**
 * Enquadramento inicial do mapa da home com a posição de quem usa (#96) — sem
 * React, sem Mapbox: o `cafe-map` só recebe os pontos e os enquadra.
 */

import { dentroDaRegiao } from "./cafe-dados";
import { distanciaKm, ordenarPorDistancia, type Coordenadas } from "./cafe-distance";

/** Sempre aparece café na tela: num bairro sem café perto, um zoom fixo mostraria um mapa vazio. */
const CAFES_NO_ENQUADRAMENTO = 3;

/**
 * A posição e os 3 cafés mais perto dela (os que houver, se forem menos).
 * `null` — o mapa abre no enquadramento de todos — sem posição, com ela fora
 * de Recife, Olinda e Jaboatão (`REGIAO`) ou sem café com coordenada válida.
 * Quem chama passa o diretório inteiro, não a lista filtrada: filtrar não mexe no mapa.
 */
export function pontosParaEnquadrar(
  cafes: readonly Coordenadas[],
  posicao: Coordenadas | null,
): Coordenadas[] | null {
  if (!posicao || !dentroDaRegiao(posicao)) return null;
  const validos = cafes.filter((cafe) => distanciaKm(posicao, cafe) !== null);
  const maisPerto = ordenarPorDistancia(validos, posicao).slice(0, CAFES_NO_ENQUADRAMENTO);
  return maisPerto.length > 0 ? [posicao, ...maisPerto] : null;
}
