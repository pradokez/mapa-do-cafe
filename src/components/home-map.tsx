"use client";

import { useSyncExternalStore } from "react";

import { CafeMap } from "@/components/cafe-map";
import type { Cafe } from "@/lib/cafe";

// Breakpoint `lg` do Tailwind: abaixo dele o mapa da home não existe (o FAB
// lista/mapa do mobile é a #13), e o celular não baixa o Mapbox à toa.
const DESKTOP = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function HomeMap({ cafes }: { cafes: Cafe[] }) {
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

  return isDesktop ? <CafeMap cafes={cafes} className="h-full" /> : null;
}
