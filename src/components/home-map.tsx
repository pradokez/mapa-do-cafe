"use client";

import { useSyncExternalStore } from "react";

import { CafeMap } from "@/components/cafe-map";

// Breakpoint `lg` do Tailwind: a partir dele o mapa fica fixo ao lado da
// lista; abaixo, só existe com a visão "mapa" do FAB — o celular não baixa o
// Mapbox enquanto ninguém pede o mapa.
const DESKTOP = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Props = Omit<React.ComponentProps<typeof CafeMap>, "variant" | "className" | "previewPlacement"> & {
  /** Visão "mapa" do mobile ligada. */
  noMobile: boolean;
};

export function HomeMap({ noMobile, ...props }: Props) {
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

  if (!isDesktop && !noMobile) return null;
  return <CafeMap {...props} previewPlacement={isDesktop ? "pin" : "bottom"} className="h-full" />;
}
