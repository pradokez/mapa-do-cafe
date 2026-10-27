"use client";

import { chipClass } from "@/components/filter-chip";
import { ChevronDownIcon, LocateIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { distanciaChipLabel, OPCOES_DE_RAIO, raioLabel, type RaioKm } from "@/lib/cafe-distance";

type Props = {
  raioKm: RaioKm | null;
  onEscolher: (km: RaioKm | null) => void;
};

/**
 * Chip + menu de distância do desktop (#161): escolha única, aplicada na hora
 * e fora da URL. O rótulo vira o raio escolhido ("Até 3 km"); "Qualquer
 * distância" desliga. No mobile, o par é o `DistanciaSheet`.
 */
export function DistanciaDropdown({ raioKm, onEscolher }: Props) {
  const ativo = raioKm !== null;
  const label = distanciaChipLabel(raioKm);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ativo ? `Distância: ${label}` : undefined}
        className={chipClass(ativo, "hidden gap-2 pl-[15px] pr-3 font-medium lg:inline-flex")}
      >
        <LocateIcon size={16} strokeWidth={2} />
        {label}
        <ChevronDownIcon size={15} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px]">
        {/* O rótulo é o valor do item: único, e volta ao raio sem conversão. */}
        <DropdownMenuRadioGroup
          value={raioLabel(raioKm)}
          onValueChange={(valor) => onEscolher(OPCOES_DE_RAIO.find((km) => raioLabel(km) === valor) ?? null)}
        >
          {OPCOES_DE_RAIO.map((km) => (
            <DropdownMenuRadioItem key={raioLabel(km)} value={raioLabel(km)}>
              {raioLabel(km)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
