"use client";

import { useState } from "react";

import { CafeList, type Hovered } from "@/components/cafe-list";
import { HomeMap } from "@/components/home-map";
import type { Cafe } from "@/lib/cafe";

/**
 * Lista + mapa da home, com o estado que os liga: hover nos dois sentidos e o
 * café selecionado (preview aberto). Estado local, sem round-trip.
 */
export function CafeDirectory({ cafes }: { cafes: Cafe[] }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hoverFrom = (source: Hovered["source"]) => (id: string | null) =>
    setHovered(id ? { id, source } : null);

  return (
    <main className="grid min-h-0 flex-1 lg:grid-cols-[45%_55%]">
      <div className="lg:overflow-y-auto">
        <h1 className="sr-only">Cafés especiais em Recife e Olinda</h1>
        <CafeList
          cafes={cafes}
          hovered={hovered}
          selectedId={selectedId}
          onHover={hoverFrom("card")}
        />
      </div>
      {/* Fixo: só a coluna da lista rola. */}
      <div className="hidden bg-map-bg lg:block">
        <HomeMap
          cafes={cafes}
          hoveredId={hovered?.id ?? null}
          selectedId={selectedId}
          onHover={hoverFrom("pin")}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </main>
  );
}
