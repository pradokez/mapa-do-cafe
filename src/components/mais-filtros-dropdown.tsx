"use client";

import { MAIS_FILTROS } from "@/components/cafe-atributos";
import { chipClass } from "@/components/filter-chip";
import { ChevronDownIcon, SlidersIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CafeFilters, FiltroBooleano } from "@/lib/cafe-filter";

type Props = {
  filters: CafeFilters;
  onToggle: (chave: FiltroBooleano) => void;
};

/**
 * Chip + menu "Mais filtros" do desktop: os atributos que não cabem na barra.
 * Como no de bairro, cada marcação aplica na hora e o menu fica aberto. No
 * mobile, os mesmos filtros estão no sheet do botão de filtros.
 */
export function MaisFiltrosDropdown({ filters, onToggle }: Props) {
  const ativos = MAIS_FILTROS.filter(({ filtro }) => filters[filtro]).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ativos === 0 ? "Mais filtros" : `Mais filtros, ${ativos} ${ativos === 1 ? "ativo" : "ativos"}`}
        className={chipClass(ativos > 0, "hidden gap-2 pl-[15px] pr-3 font-medium lg:inline-flex")}
      >
        <SlidersIcon size={16} strokeWidth={2} />
        {ativos === 0 ? "Mais filtros" : `Mais filtros · ${ativos}`}
        <ChevronDownIcon size={15} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        {MAIS_FILTROS.map(({ filtro, label, Icon }) => (
          <DropdownMenuCheckboxItem
            key={filtro}
            checked={filters[filtro]}
            onCheckedChange={() => onToggle(filtro)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex items-center gap-2">
              <Icon size={16} strokeWidth={1.9} className="text-ink-2" />
              {label}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
