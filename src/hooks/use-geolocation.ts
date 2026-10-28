"use client";

import { useSyncExternalStore } from "react";

import type { Coordenadas } from "@/lib/cafe-distance";

export type GeolocationStatus = "idle" | "prompting" | "granted" | "denied" | "unavailable";

// Não `Geolocation`: esse nome já é o tipo do DOM de `navigator.geolocation`.
// `tentando`: uma nova tentativa por gesto (`tentarDeNovo`) está em curso.
export type GeoState = { status: GeolocationStatus; coords: Coordenadas | null; tentando: boolean };

const IDLE: GeoState = { status: "idle", coords: null, tentando: false };

// Store do módulo: a posição sobrevive à navegação client-side (home → detalhe)
// e o navegador é consultado uma vez por carregamento de página.
let state: GeoState = IDLE;
const listeners = new Set<() => void>();
let tentativa: Promise<boolean> | null = null;

/**
 * Teto de uma nova tentativa: um pedido nunca respondido (o Firefox deixa o
 * prompt pendente quando a pessoa clica fora) não pode travar o chip girando.
 */
export const TETO_DA_TENTATIVA_MS = 15_000;

function set(next: Partial<GeoState>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

const gravarPosicao = ({ coords }: GeolocationPosition) =>
  set({ status: "granted", coords: { lat: coords.latitude, lng: coords.longitude } });
// Uma falha nunca apaga a posição que outro pedido já trouxe.
const gravarFalha = (error: GeolocationPositionError) => {
  if (state.coords) return;
  set({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable", coords: null });
};

function locate(depois?: (ok: boolean) => void) {
  navigator.geolocation.getCurrentPosition(
    (posicao) => {
      gravarPosicao(posicao);
      depois?.(true);
    },
    (error) => {
      gravarFalha(error);
      depois?.(false);
    },
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

/**
 * Nova leitura única, disparada por gesto (o chip "Distância" sem posição,
 * #164): `true` se a posição veio. Recusa já registrada responde na hora,
 * com erro; quem tinha ignorado o pedido ou estava com o GPS desligado ganha
 * outra chance.
 */
export function tentarDeNovo(): Promise<boolean> {
  if (!("geolocation" in navigator)) return Promise.resolve(false);
  // Com uma em curso, outro toque recebe a mesma resposta, sem novo pedido.
  if (tentativa) return tentativa;
  set({ tentando: true });
  tentativa = new Promise<boolean>((resolve) => {
    // Quem chega primeiro decide: a resposta ou o teto. A posição que chegar
    // depois do teto ainda entra (`locate` grava antes de chamar o fim).
    let encerrada = false;
    const fim = (ok: boolean) => {
      if (encerrada) return;
      encerrada = true;
      clearTimeout(teto);
      tentativa = null;
      set({ tentando: false });
      resolve(ok);
    };
    const teto = setTimeout(() => fim(false), TETO_DA_TENTATIVA_MS);
    locate(fim);
  });
  return tentativa;
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
