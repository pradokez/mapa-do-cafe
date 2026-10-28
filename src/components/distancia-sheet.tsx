"use client";

import { chipClass } from "@/components/filter-chip";
import { ChevronDownIcon } from "@/components/icons";
import { IconeDaDistancia } from "@/components/localizacao-tentativa";
import { RaioOpcoes, RascunhoSheet, type AplicarFiltros } from "@/components/rascunho-sheet";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Cafe } from "@/lib/cafe";
import { distanciaChipLabel, type Coordenadas } from "@/lib/cafe-distance";
import type { CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

type Props = {
  cafes: Cafe[];
  festivais: FestivaisNoAr;
  origem: Coordenadas | null;
  filters: CafeFilters;
  /** Toque no chip apagado (sem `origem`): tenta a localização de novo, sem abrir o sheet. */
  onTentar: () => void;
  onAplicar: AplicarFiltros;
};

/**
 * Chip + bottom sheet de distância do mobile (abaixo de `lg`) — o par do
 * `DistanciaDropdown`. Escolha única no rascunho; "Ver N cafés" aplica.
 */
export function DistanciaSheet({ cafes, festivais, origem, filters, onTentar, onAplicar }: Props) {
  const ativo = filters.raioKm !== null;
  const { tentando } = useGeolocation();
  const label = distanciaChipLabel(filters.raioKm);

  return (
    <RascunhoSheet
      titulo="Distância"
      cafes={cafes}
      festivais={festivais}
      origem={origem}
      filters={filters}
      onAplicar={onAplicar}
      trigger={
        <button
          type="button"
          aria-label={ativo ? `Distância: ${label}` : undefined}
          aria-disabled={!origem || undefined}
          aria-busy={(!origem && tentando) || undefined}
          onClick={(e) => {
            if (origem) return;
            // O Radix não abre um clique já cancelado.
            e.preventDefault();
            onTentar();
          }}
          className={chipClass(origem ? ativo : "apagado", "gap-1.5 pl-[13px] pr-[11px] font-medium lg:hidden")}
        >
          <IconeDaDistancia semPosicao={!origem} size={15} />
          {label}
          <ChevronDownIcon size={14} strokeWidth={2} />
        </button>
      }
    >
      {(rascunho, mudar) => (
        <RaioOpcoes raioKm={rascunho.raioKm} onEscolher={(raioKm) => mudar({ ...rascunho, raioKm })} />
      )}
    </RascunhoSheet>
  );
}
