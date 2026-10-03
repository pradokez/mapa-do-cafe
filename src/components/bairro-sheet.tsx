"use client";

import { chipClass } from "@/components/filter-chip";
import { FilterSheet, SheetOption } from "@/components/filter-sheet";
import { ChevronDownIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { alternar, bairroChipLabel, type BairroOpcao, type CafeFilters } from "@/lib/cafe-filter";

type Props = {
  cafes: Cafe[];
  bairros: BairroOpcao[];
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
};

/**
 * Chip + bottom sheet de bairro do mobile — o par do `BairroDropdown`.
 * Multi-select (desvio consciente do design, que tinha escolha única):
 * "Todos os bairros" limpa a seleção do rascunho.
 */
export function BairroSheet({ cafes, bairros, filters, onAplicar }: Props) {
  const label = bairroChipLabel(filters.bairros, bairros);
  const ativo = filters.bairros.length > 0;

  return (
    <FilterSheet
      titulo="Bairro"
      cafes={cafes}
      filters={filters}
      onAplicar={onAplicar}
      trigger={
        <button
          type="button"
          aria-label={ativo ? `Bairro: ${label}` : undefined}
          className={chipClass(ativo, "gap-1.5 pl-[13px] pr-[11px] font-medium")}
        >
          {label}
          <ChevronDownIcon size={14} strokeWidth={2} />
        </button>
      }
    >
      {(rascunho, mudar) => (
        <>
          <SheetOption
            checked={rascunho.bairros.length === 0}
            onToggle={() => mudar({ ...rascunho, bairros: [] })}
          >
            Todos os bairros
          </SheetOption>
          {bairros.map(({ slug, nome }) => (
            <SheetOption
              key={slug}
              checked={rascunho.bairros.includes(slug)}
              onToggle={() => mudar({ ...rascunho, bairros: alternar(rascunho.bairros, slug) })}
            >
              {nome}
            </SheetOption>
          ))}
        </>
      )}
    </FilterSheet>
  );
}
