/**
 * Enquadramento inicial do mapa da home com a posição de quem usa (#96) — sem
 * React, sem Mapbox: o `cafe-map` só recebe os pontos e os enquadra.
 */

import { dentroDaRegiao } from "./cafe-dados";
import { distanciaKm, ordenarPorDistancia, RAIO_TERRA_KM, type Coordenadas } from "./cafe-distance";

/**
 * Como o mapa enquadra pontos (`fitBounds`): o `cafe-map` e os pins-fantasma
 * (`enquadramento-fantasma`, #142) leem daqui, para os dois não divergirem.
 * Pins ancorados pela ponta sobem 40 px a partir do ponto; o zoom ocupa a direita.
 */
export const FIT_PADDING = { top: 72, right: 72, bottom: 32, left: 32 };
export const MAX_ZOOM = 15;

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

const rad = (graus: number) => (graus * Math.PI) / 180;
const graus = (radianos: number) => (radianos * 180) / Math.PI;

/**
 * O círculo do raio de distância (#165) como anel `[lng, lat]`, fechado no
 * primeiro ponto (o formato do polígono GeoJSON): cada ponto a `km` do centro
 * na mesma esfera do haversine, para o círculo e o filtro (`dentroDoRaio`) baterem.
 */
export function circuloDoRaio(centro: Coordenadas, km: number, passos = 64): [number, number][] {
  const angulo = km / RAIO_TERRA_KM;
  const lat1 = rad(centro.lat);
  const lng1 = rad(centro.lng);
  const anel: [number, number][] = [];
  for (let i = 0; i < passos; i++) {
    const rumo = (2 * Math.PI * i) / passos;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angulo) + Math.cos(lat1) * Math.sin(angulo) * Math.cos(rumo));
    const lng2 =
      lng1 +
      Math.atan2(Math.sin(rumo) * Math.sin(angulo) * Math.cos(lat1), Math.cos(angulo) - Math.sin(lat1) * Math.sin(lat2));
    anel.push([graus(lng2), graus(lat2)]);
  }
  anel.push(anel[0]);
  return anel;
}

/** Cantos sudoeste e nordeste do círculo do raio: o que o mapa enquadra com o raio ligado. */
export function limitesDoCirculo(centro: Coordenadas, km: number): [Coordenadas, Coordenadas] {
  const anel = circuloDoRaio(centro, km);
  const lngs = anel.map(([lng]) => lng);
  const lats = anel.map(([, lat]) => lat);
  return [
    { lat: Math.min(...lats), lng: Math.min(...lngs) },
    { lat: Math.max(...lats), lng: Math.max(...lngs) },
  ];
}
