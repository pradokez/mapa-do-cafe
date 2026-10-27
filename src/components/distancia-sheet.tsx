"use client";

import { chipClass } from "@/components/filter-chip";
import { ChevronDownIcon, LocateIcon } from "@/components/icons";
import { RaioOpcoes, RascunhoSheet } from "@/components/rascunho-sheet";
import type { Cafe } from "@/lib/cafe";
import { distanciaChipLabel, type Coordenadas } from "@/lib/cafe-distance";
import type { CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

type Props = {
  cafes: Cafe[];
  festivais: FestivaisNoAr;
  origem: Coordenadas | null;
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
};

/**
 * Chip + bottom sheet de distância do mobile (abaixo de `lg`) — o par do
 * `DistanciaDropdown`. Escolha única no rascunho; "Ver N cafés" aplica.
 */
export function DistanciaSheet({ cafes, festivais, origem, filters, onAplicar }: Props) {
  const ativo = filters.raioKm !== null;
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
          className={chipClass(ativo, "gap-1.5 pl-[13px] pr-[11px] font-medium lg:hidden")}
        >
          <LocateIcon size={15} strokeWidth={2} />
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
