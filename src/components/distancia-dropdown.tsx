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
import { RAIOS_KM, raioLabel, type RaioKm } from "@/lib/cafe-distance";

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ativo ? `Distância: ${raioLabel(raioKm)}` : undefined}
        className={chipClass(ativo, "hidden gap-2 pl-[15px] pr-3 font-medium lg:inline-flex")}
      >
        <LocateIcon size={16} strokeWidth={2} />
        {ativo ? raioLabel(raioKm) : "Distância"}
        <ChevronDownIcon size={15} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px]">
        <DropdownMenuRadioGroup
          value={String(raioKm)}
          onValueChange={(valor) => onEscolher(valor === "null" ? null : (Number(valor) as RaioKm))}
        >
          {[...RAIOS_KM, null].map((km) => (
            <DropdownMenuRadioItem key={String(km)} value={String(km)}>
              {raioLabel(km)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
