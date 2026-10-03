"use client";

import { useGeolocation } from "@/hooks/use-geolocation";
import { distanciaLabel, type Coordenadas } from "@/lib/cafe-distance";

/**
 * " · 1,2 km" para pendurar depois do local do café (card, preview, detalhe).
 * Sem posição — permissão negada, indisponível ou ainda não decidida — não
 * renderiza nada, e a linha fica idêntica à de antes.
 */
export function Distancia({ destino, sufixo = "" }: { destino: Coordenadas; sufixo?: string }) {
  const { coords } = useGeolocation();
  const label = distanciaLabel(coords, destino);
  if (!label) return null;

  return (
    <>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
      {label}
      {sufixo}
    </>
  );
}
