export type Coordenadas = { lat: number; lng: number };

const RAIO_TERRA_KM = 6371;
const rad = (graus: number) => (graus * Math.PI) / 180;

/**
 * Distância em linha reta (haversine), em km. Sem origem conhecida (permissão
 * negada, indisponível ou ainda não decidida) a distância não existe: `null`,
 * nunca 0 nem `NaN`.
 */
export function distanciaKm(origem: Coordenadas | null, destino: Coordenadas): number | null {
  if (!origem || ![origem.lat, origem.lng, destino.lat, destino.lng].every(Number.isFinite)) {
    return null;
  }
  const dLat = rad(destino.lat - origem.lat);
  const dLng = rad(destino.lng - origem.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(origem.lat)) * Math.cos(rad(destino.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
}

const KM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * "1,2 km". Abaixo de 1 km, metros de 10 em 10 ("850 m") — precisão maior que
 * essa seria falsa, o GPS do navegador erra por dezenas de metros. Piso de
 * 10 m (nunca "0 m"); o que arredonda para 1000 m já sai em km.
 */
export function formatarDistancia(km: number): string {
  const metros = Math.max(10, Math.round(km * 100) * 10);
  return metros < 1000 ? `${metros} m` : `${KM.format(km)} km`;
}

/** Distância pronta para exibir, ou `null` quando não há o que mostrar. */
export function distanciaLabel(origem: Coordenadas | null, destino: Coordenadas): string | null {
  const km = distanciaKm(origem, destino);
  return km === null ? null : formatarDistancia(km);
}

/**
 * Do mais perto ao mais longe, sem mutar a entrada. Sem origem, a ordem de
 * entrada fica como está; empate também a mantém (sort estável), e item sem
 * coordenada válida vai para o fim.
 */
export function ordenarPorDistancia<T extends Coordenadas>(
  itens: readonly T[],
  origem: Coordenadas | null,
): T[] {
  // Sem origem, toda distância é Infinity: tudo empata e nada sai do lugar.
  return itens
    .map((item) => ({ item, km: distanciaKm(origem, item) ?? Infinity }))
    // `===` antes da subtração: Infinity − Infinity é NaN, não empate.
    .sort((a, b) => (a.km === b.km ? 0 : a.km - b.km))
    .map(({ item }) => item);
}
