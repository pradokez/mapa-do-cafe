"use client";

import { useMemo, useState } from "react";

import { CafeList, type Hovered } from "@/components/cafe-list";
import { FilterBar } from "@/components/filter-bar";
import { FiltrosSheet } from "@/components/filtros-sheet";
import { HomeMap } from "@/components/home-map";
import { MapFab } from "@/components/map-fab";
import { SearchField } from "@/components/search-field";
import { SiteHeader } from "@/components/site-header";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Cafe } from "@/lib/cafe";
import { ordenarPorDistancia } from "@/lib/cafe-distance";
import { bairrosDisponiveis, filtrarCafes, temFiltroAtivo } from "@/lib/cafe-filter";

/**
 * Header com a busca + lista + mapa da home, com o estado que os liga: o
 * recorte dos filtros e da busca (na URL), a ordem por distância (com
 * posição), hover nos dois sentidos, o café selecionado (preview aberto) e,
 * no mobile, a visão lista ou mapa do FAB — estado local, fora da URL: a home
 * sempre abre na lista. Tudo no cliente, sem round-trip.
 */
export function CafeDirectory({ cafes }: { cafes: Cafe[] }) {
  const bairros = useMemo(() => bairrosDisponiveis(cafes), [cafes]);
  const slugs = useMemo(() => bairros.map((b) => b.slug), [bairros]);
  const { filters, toggle, toggleBairro, limparBairros, togglePreco, buscar, aplicar, limpar } =
    useFilterParams(slugs);
  // Com posição, do mais perto ao mais longe; sem ela (e no HTML do servidor),
  // a ordem alfabética do repositório. Memo: o mapa refaz os pins quando a
  // lista muda de identidade.
  const { coords } = useGeolocation();
  const filtrados = useMemo(
    () => ordenarPorDistancia(filtrarCafes(cafes, filters), coords),
    [cafes, filters, coords],
  );

  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "mapa">("lista");

  // Café que saiu do recorte não fica em hover nem com o preview aberto.
  const visivel = (id: string | null | undefined) =>
    id != null && filtrados.some((c) => c.id === id);
  const hoveredVisivel = visivel(hovered?.id) ? hovered : null;
  const selectedId = visivel(selected) ? selected : null;

  const hoverFrom = (source: Hovered["source"]) => (id: string | null) =>
    setHovered(id ? { id, source } : null);

  // Voltar para a lista fecha o card do pin.
  const alternarView = () => {
    if (view === "mapa") setSelected(null);
    setView(view === "lista" ? "mapa" : "lista");
  };

  return (
    <>
      <SiteHeader actions={<FiltrosSheet cafes={cafes} filters={filters} onAplicar={aplicar} />}>
        <SearchField value={filters.q} onSearch={buscar} />
      </SiteHeader>
      <main className="flex min-h-0 flex-1 flex-col">
        <FilterBar
          cafes={cafes}
          filters={filters}
          bairros={bairros}
          onToggle={toggle}
          onToggleBairro={toggleBairro}
          onLimparBairros={limparBairros}
          onTogglePreco={togglePreco}
          onAplicar={aplicar}
        />
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[45%_55%]">
          {/* relative: containing block dos sr-only (absolute) dos cards — sem
              isso eles escapam do scroll e esticam a página além da viewport.
              scroll-py: o card focado por Tab rola até a borda; sem folga, o
              anel de foco (e o card elevado) saem cortados. */}
          <div className={`relative scroll-py-3 overflow-y-auto lg:block ${view === "mapa" ? "hidden" : ""}`}>
            <h1 className="sr-only">Cafés especiais em Recife e Olinda</h1>
            <CafeList
              cafes={filtrados}
              hovered={hoveredVisivel}
              selectedId={selectedId}
              onHover={hoverFrom("card")}
              onLimpar={temFiltroAtivo(filters) ? limpar : undefined}
            />
          </div>
          {/* Fixo: só a coluna da lista rola. No mobile, o mapa em tela cheia da visão "mapa". */}
          <div className={`bg-map-bg lg:block ${view === "lista" ? "hidden" : ""}`}>
            <HomeMap
              visivelNoMobile={view === "mapa"}
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
      <MapFab view={view} onToggle={alternarView} />
    </>
  );
}
