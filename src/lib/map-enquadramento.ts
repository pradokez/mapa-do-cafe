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

/** Pontos do anel: múltiplo de 4, para os extremos (norte, leste, sul, oeste) estarem nele. */
const PASSOS_DO_CIRCULO = 64;

/**
 * O círculo do raio (#165) como anel de polígono, fechado (o último ponto repete
 * o primeiro, como pede o GeoJSON): cada ponto a `km` do centro pela mesma esfera
 * do haversine (`distanciaKm`), então o círculo desenhado é o que o filtro usa.
 */
export function circuloDoRaio(centro: Coordenadas, km: number): Coordenadas[] {
  const angulo = km / RAIO_TERRA_KM;
  const lat0 = rad(centro.lat);
  const anel: Coordenadas[] = [];
  for (let i = 0; i < PASSOS_DO_CIRCULO; i++) {
    const rumo = (2 * Math.PI * i) / PASSOS_DO_CIRCULO;
    const lat = Math.asin(Math.sin(lat0) * Math.cos(angulo) + Math.cos(lat0) * Math.sin(angulo) * Math.cos(rumo));
    const dLng = Math.atan2(
      Math.sin(rumo) * Math.sin(angulo) * Math.cos(lat0),
      Math.cos(angulo) - Math.sin(lat0) * Math.sin(lat),
    );
    anel.push({ lat: graus(lat), lng: centro.lng + graus(dLng) });
  }
  return [...anel, anel[0]];
}

/** Sudoeste e nordeste do círculo do raio: o que o mapa enquadra quando o raio muda. */
export function limitesDoRaio(centro: Coordenadas, km: number): [Coordenadas, Coordenadas] {
  const anel = circuloDoRaio(centro, km);
  const lats = anel.map((p) => p.lat);
  const lngs = anel.map((p) => p.lng);
  return [
    { lat: Math.min(...lats), lng: Math.min(...lngs) },
    { lat: Math.max(...lats), lng: Math.max(...lngs) },
  ];
}

const rad = (g: number) => (g * Math.PI) / 180;
const graus = (r: number) => (r * 180) / Math.PI;
