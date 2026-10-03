"use client";

import { useSyncExternalStore } from "react";

import type { Coordenadas } from "@/lib/cafe-distance";

export type GeolocationStatus = "idle" | "prompting" | "granted" | "denied" | "unavailable";

export type Geolocation = { status: GeolocationStatus; coords: Coordenadas | null };

const IDLE: Geolocation = { status: "idle", coords: null };

// Store do módulo: a posição sobrevive à navegação client-side (home → detalhe)
// e o navegador é consultado uma vez por carregamento de página.
let state: Geolocation = IDLE;
const listeners = new Set<() => void>();

function set(next: Geolocation) {
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
 * Pede a posição uma única vez. Recusa já registrada no navegador não vira
 * novo pedido; sem suporte, `unavailable`. Sem `useEffect`: o primeiro
 * `subscribe` (só no cliente, após a hidratação) é quem dispara.
 */
function start() {
  if (!("geolocation" in navigator)) return set({ status: "unavailable", coords: null });
  // Sai de `idle` já, antes da consulta assíncrona: outro `subscribe` no meio
  // dela não dispara um segundo pedido.
  set({ status: "prompting", coords: null });
  if (!navigator.permissions) return locate();
  navigator.permissions
    .query({ name: "geolocation" })
    .then((permission) =>
      permission.state === "denied" ? set({ status: "denied", coords: null }) : locate(),
    )
    .catch(locate);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (state === IDLE) start();
  return () => listeners.delete(onChange);
}

/** Posição do navegador. No servidor e antes de decidir: `idle`, sem coordenadas. */
export function useGeolocation(): Geolocation {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}
