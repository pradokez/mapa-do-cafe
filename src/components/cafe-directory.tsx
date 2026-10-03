"use client";

import { useMemo, useState } from "react";

import { CafeList, type Hovered } from "@/components/cafe-list";
import { FilterBar } from "@/components/filter-bar";
import { HomeMap } from "@/components/home-map";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { Cafe } from "@/lib/cafe";
import { filtrarCafes, temFiltroAtivo } from "@/lib/cafe-filter";

/**
 * Lista + mapa da home, com o estado que os liga: o recorte dos filtros (na
 * URL), hover nos dois sentidos e o café selecionado (preview aberto). Tudo no
 * cliente, sem round-trip.
 */
export function CafeDirectory({ cafes }: { cafes: Cafe[] }) {
  const { filters, toggle, limpar } = useFilterParams();
  // Memo: o mapa refaz os pins quando a lista muda de identidade.
  const filtrados = useMemo(() => filtrarCafes(cafes, filters), [cafes, filters]);

  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Café que saiu do recorte não fica em hover nem com o preview aberto.
  const visivel = (id: string | null | undefined) =>
    id != null && filtrados.some((c) => c.id === id);
  const hoveredVisivel = visivel(hovered?.id) ? hovered : null;
  const selectedId = visivel(selected) ? selected : null;

  const hoverFrom = (source: Hovered["source"]) => (id: string | null) =>
    setHovered(id ? { id, source } : null);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <FilterBar filters={filters} onToggle={toggle} />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[45%_55%]">
        {/* relative: containing block dos sr-only (absolute) dos cards — sem
            isso eles escapam do scroll e esticam a página além da viewport. */}
        <div className="relative lg:overflow-y-auto">
          <h1 className="sr-only">Cafés especiais em Recife e Olinda</h1>
          <CafeList
            cafes={filtrados}
            hovered={hoveredVisivel}
            selectedId={selectedId}
            onHover={hoverFrom("card")}
            onLimpar={temFiltroAtivo(filters) ? limpar : undefined}
          />
        </div>
        {/* Fixo: só a coluna da lista rola. */}
        <div className="hidden bg-map-bg lg:block">
          <HomeMap
            cafes={filtrados}
            hoveredId={hoveredVisivel?.id ?? null}
            selectedId={selectedId}
            onHover={hoverFrom("pin")}
            onSelect={setSelected}
            onClose={() => setSelected(null)}
          />
        </div>
      </div>
    </main>
  );
}
