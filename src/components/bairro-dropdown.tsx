"use client";

import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { chipClass } from "@/components/filter-chip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bairroChipLabel, type BairroOpcao } from "@/lib/cafe-filter";

type Props = {
  bairros: BairroOpcao[];
  selecionados: string[];
  onToggle: (slug: string) => void;
  onLimpar: () => void;
};

/**
 * Chip + menu de bairro. Multi-select é desvio consciente do design (que tinha
 * escolha única): marcar um bairro mantém o menu aberto para marcar outros;
 * "Todos os bairros" limpa a seleção e fecha.
 */
export function BairroDropdown({ bairros, selecionados, onToggle, onLimpar }: Props) {
  const label = bairroChipLabel(selecionados, bairros);
  const ativo = selecionados.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ativo ? `Bairro: ${label}` : undefined}
        className={chipClass(ativo, "gap-2 pl-[15px] pr-3 font-medium")}
      >
        <MapPinIcon size={16} strokeWidth={2} />
        {label}
        <ChevronDownIcon size={15} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px]">
        <DropdownMenuCheckboxItem checked={!ativo} onCheckedChange={() => ativo && onLimpar()}>
          Todos os bairros
        </DropdownMenuCheckboxItem>
        {bairros.map(({ slug, nome }) => (
          <DropdownMenuCheckboxItem
            key={slug}
            checked={selecionados.includes(slug)}
            onCheckedChange={() => onToggle(slug)}
            onSelect={(event) => event.preventDefault()}
          >
            {nome}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
