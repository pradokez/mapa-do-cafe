import { CarIcon, LaptopIcon, PawIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import type { FiltroBooleano } from "@/lib/cafe-filter";

/**
 * Atributos booleanos exibidos no card, nas tags do detalhe e como chips da
 * barra de filtros (`filtro`), na ordem do design.
 */
export const ATRIBUTOS = [
  { key: "aceita_pets", filtro: "pets", label: "Aceita pets", Icon: PawIcon },
  { key: "tem_estacionamento", filtro: "estacionamento", label: "Tem estacionamento", Icon: CarIcon },
  { key: "permite_coffee_office", filtro: "coffeeOffice", label: "Permite coffee office", Icon: LaptopIcon },
] as const satisfies ReadonlyArray<{
  key: keyof Cafe;
  filtro: FiltroBooleano;
  label: string;
  Icon: unknown;
}>;

export function atributosDo(cafe: Cafe) {
  return ATRIBUTOS.filter(({ key }) => cafe[key]);
}
