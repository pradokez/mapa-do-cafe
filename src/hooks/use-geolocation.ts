"use client";

import { useSyncExternalStore } from "react";

import type { Coordenadas } from "@/lib/cafe-distance";

export type GeolocationStatus = "idle" | "prompting" | "granted" | "denied" | "unavailable";

// Não `Geolocation`: esse nome já é o tipo do DOM de `navigator.geolocation`.
export type GeoState = { status: GeolocationStatus; coords: Coordenadas | null };

const IDLE: GeoState = { status: "idle", coords: null };

// Store do módulo: a posição sobrevive à navegação client-side (home → detalhe)
// e o navegador é consultado uma vez por carregamento de página.
let state: GeoState = IDLE;
const listeners = new Set<() => void>();

function set(next: GeoState) {
  state = next;
  listeners.forEach((notify) => notify());
}

function locate() {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => set({ status: "granted", coords: { lat: coords.latitude, lng: coords.longitude } }),
    (error) =>
      set({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable", coords: null }),
    { maximumAge: 5 * 60_000, timeout: 10_000 },
  );
}

/**
 * Pede a posição uma única vez; sem suporte, `unavailable`. Recusa já
 * registrada não vira novo pedido: o próprio navegador responde com erro, sem
 * prompt. Sem `useEffect`: o primeiro `subscribe` (só no cliente, após a
 * hidratação) é quem dispara.
 *
 * Sem consultar a Permissions API antes: além de redundante, com ela o Safari
 * do iPhone não mostrava o prompt mesmo com o site em "Perguntar".
 */
function start() {
  if (!("geolocation" in navigator)) return set({ status: "unavailable", coords: null });
  set({ status: "prompting", coords: null });
  locate();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (state === IDLE) start();
  return () => listeners.delete(onChange);
}

/** Posição do navegador. No servidor e antes de decidir: `idle`, sem coordenadas. */
export function useGeolocation(): GeoState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}
