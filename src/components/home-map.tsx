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

// As props do mapa navegável (`full`), não as do mini.
type Props = Omit<
  Extract<React.ComponentProps<typeof CafeMap>, { variant?: "full" }>,
  "variant" | "className" | "previewPlacement"
> & {
  /** Visão "mapa" do mobile ligada. */
  visivelNoMobile: boolean;
};

export function HomeMap({ visivelNoMobile, ...props }: Props) {
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

  if (!isDesktop && !visivelNoMobile) return null;
  return <CafeMap {...props} previewPlacement={isDesktop ? "pin" : "bottom"} className="h-full" />;
}
