"use client";

import { useState } from "react";

import { chipClass } from "@/components/filter-chip";
import { ChevronDownIcon } from "@/components/icons";
import { IconeDaDistancia } from "@/components/localizacao-tentativa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGeolocation } from "@/hooks/use-geolocation";
import { distanciaChipLabel, OPCOES_DE_RAIO, raioLabel, type RaioKm } from "@/lib/cafe-distance";

type Props = {
  raioKm: RaioKm | null;
  /** Sem posição do navegador: o chip fica apagado. */
  semPosicao: boolean;
  /** Toque no chip apagado: tenta a localização de novo, sem abrir o menu. */
  onTentar: () => void;
  onEscolher: (km: RaioKm | null) => void;
};

/**
 * Chip + menu de distância do desktop (#161): escolha única, aplicada na hora
 * e fora da URL. O rótulo vira o raio escolhido ("Até 3 km"); "Qualquer
 * distância" desliga. No mobile, o par é o `DistanciaSheet`.
 */
export function DistanciaDropdown({ raioKm, semPosicao, onTentar, onEscolher }: Props) {
  const [aberto, setAberto] = useState(false);
  const { tentando } = useGeolocation();
  const ativo = raioKm !== null;
  const label = distanciaChipLabel(raioKm);

  return (
    // Controlado: sem posição, o mesmo gatilho (o foco fica nele quando a
    // posição chega) tenta de novo em vez de abrir.
    <DropdownMenu open={aberto} onOpenChange={(abrir) => (abrir && semPosicao ? onTentar() : setAberto(abrir))}>
      <DropdownMenuTrigger
        aria-label={ativo ? `Distância: ${label}` : undefined}
        aria-disabled={semPosicao || undefined}
        aria-busy={(semPosicao && tentando) || undefined}
        className={chipClass(semPosicao ? "apagado" : ativo, "hidden gap-2 pl-[15px] pr-3 font-medium lg:inline-flex")}
      >
        <IconeDaDistancia semPosicao={semPosicao} size={16} />
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
