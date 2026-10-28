"use client";

import { useMemo, useState } from "react";

import { ApoioPix } from "@/components/apoio-pix";
import { CafeList, type Hovered } from "@/components/cafe-list";
import { FestivalVitrine } from "@/components/festival-vitrine";
import { FilterBar } from "@/components/filter-bar";
import { FiltrosSheet } from "@/components/filtros-sheet";
import { HomeMap } from "@/components/home-map";
import { MapFab } from "@/components/map-fab";
import { HOME_COLUNAS, LISTA_ROLAGEM } from "@/components/medidas";
import { SearchField } from "@/components/search-field";
import { SiteHeader } from "@/components/site-header";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Cafe } from "@/lib/cafe";
import { ordenarPorDistancia } from "@/lib/cafe-distance";
import { bairrosDisponiveis, filtrarCafes, temFiltroAtivo } from "@/lib/cafe-filter";
import { combosDaEdicao, type Edicao, type FestivaisNoAr } from "@/lib/festival";
import { pontosParaEnquadrar } from "@/lib/map-enquadramento";
import type { ConfigDoPix } from "@/lib/pix";

/**
 * Header com a busca + lista + mapa da home, com o estado que os liga: o
 * recorte dos filtros e da busca (na URL, com os festivais no ar e o instante
 * do "Aberto agora", #162), o raio de
 * distância (local, fora da URL, #161), a ordem por distância (com posição), hover nos dois sentidos, o café selecionado (preview aberto) e,
 * no mobile, a visão lista ou mapa do FAB — estado local, fora da URL: a home
 * sempre abre na lista. Tudo no cliente, sem round-trip. As vitrines dos
 * festivais no ar (#106) ficam no topo da lista só sem filtro nem busca.
 * Com o Pix configurado, o "Me paga um café?" (#121) entra no header.
 */
export function CafeDirectory({
  cafes,
  festivais,
  vitrines,
  agora,
  pix = null,
}: {
  cafes: Cafe[];
  festivais: FestivaisNoAr;
  /** Edições com vitrine hoje (`edicoesEmVitrine`). */
  vitrines: Edicao[];
  /**
   * O instante em que o servidor decidiu: o da vitrine e o primeiro do
   * "Aberto agora", para o HTML já sair filtrado e a hidratação bater.
   */
  agora: Date;
  /** `configDoPix` das envs; sem ela, o botão de apoio não aparece. */
  pix?: ConfigDoPix | null;
}) {
  const bairros = useMemo(() => bairrosDisponiveis(cafes), [cafes]);
  const slugs = useMemo(() => bairros.map((b) => b.slug), [bairros]);
  const {
    filters: escolhidos,
    agora: agoraDoFiltro,
    toggle,
    toggleBairro,
    limparBairros,
    togglePreco,
    buscar,
    escolherRaio,
    aplicar,
    limpar,
  } = useFilterParams(slugs, festivais, agora);
  // Com posição, do mais perto ao mais longe; sem ela (e no HTML do servidor),
  // a ordem alfabética do repositório. Memo: o mapa refaz os pins quando a
  // lista muda de identidade.
  const { coords } = useGeolocation();
  // Sem posição, o raio não tem centro: não filtra, não conta no badge, não
  // esconde a vitrine e o chip fica em "Distância". Com ela, o escolhido vale.
  const filters = useMemo(() => (coords ? escolhidos : { ...escolhidos, raioKm: null }), [coords, escolhidos]);
  const filtrados = useMemo(
    () => ordenarPorDistancia(filtrarCafes(cafes, filters, { festivais, origem: coords, agora: agoraDoFiltro }), coords),
    [cafes, filters, festivais, coords, agoraDoFiltro],
  );
  // O mapa abre na posição e nos cafés mais perto do diretório inteiro, não do recorte.
  const focus = useMemo(() => pontosParaEnquadrar(cafes, coords), [cafes, coords]);

  // Os cafés dos combos saem da lista que já veio, sem repetir no payload.
  const combosDasVitrines = useMemo(
    () =>
      vitrines
        .map((edicao) => ({ edicao, combos: combosDaEdicao(edicao, cafes) }))
        .filter(({ combos }) => combos.length > 0),
    [vitrines, cafes],
  );
  const comFiltro = temFiltroAtivo(filters);

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
      <SiteHeader
        actions={
          <>
            {pix && <ApoioPix config={pix} variante="mobile" />}
            <FiltrosSheet cafes={cafes} festivais={festivais} origem={coords} filters={filters} onAplicar={aplicar} />
          </>
        }
        extra={pix && <ApoioPix config={pix} variante="desktop" />}
      >
        <SearchField value={filters.q} onSearch={buscar} />
      </SiteHeader>
      <main className="flex min-h-0 flex-1 flex-col">
        <FilterBar
          cafes={cafes}
          festivais={festivais}
          origem={coords}
          filters={filters}
          bairros={bairros}
          onToggle={toggle}
          onToggleBairro={toggleBairro}
          onLimparBairros={limparBairros}
          onTogglePreco={togglePreco}
          onEscolherRaio={escolherRaio}
          onAplicar={aplicar}
        />
        <div className={HOME_COLUNAS}>
          {/* relative: containing block dos sr-only (absolute) dos cards — sem
              isso eles escapam do scroll e esticam a página além da viewport.
              scroll-py: o card focado por Tab rola até a borda; sem folga, o
              anel de foco (e o card elevado) saem cortados. */}
          <div className={`${LISTA_ROLAGEM} ${view === "mapa" ? "hidden" : ""}`}>
            <h1 className="sr-only">Cafés especiais em Recife e Olinda</h1>
            <CafeList
              cafes={filtrados}
              festivais={festivais}
              hovered={hoveredVisivel}
              selectedId={selectedId}
              onHover={hoverFrom("card")}
              onLimpar={comFiltro ? limpar : undefined}
              topo={
                !comFiltro &&
                combosDasVitrines.map(({ edicao, combos }) => (
                  <FestivalVitrine key={edicao.id} edicao={edicao} combos={combos} agora={agora} />
                ))
              }
            />
          </div>
          {/* Fixo: só a coluna da lista rola. No mobile, o mapa em tela cheia da visão "mapa". */}
          <div className={`bg-map-bg lg:block ${view === "lista" ? "hidden" : ""}`}>
            <HomeMap
              visivelNoMobile={view === "mapa"}
              cafes={filtrados}
              userPosition={coords}
              focus={focus}
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
