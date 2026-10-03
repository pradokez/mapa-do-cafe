import { CarIcon, CoffeeIcon, LaptopIcon, PawIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import type { FiltroBooleano } from "@/lib/cafe-filter";

/**
 * Atributos booleanos exibidos no card, nas tags do detalhe e como chips da
 * barra de filtros (`filtro`), na ordem do design. `curto`: rótulo visível do
 * chip no mobile, como no design; o rótulo acessível continua o `label`.
 */
export const ATRIBUTOS = [
  { key: "aceita_pets", filtro: "pets", label: "Aceita pets", curto: "Pets", Icon: PawIcon },
  { key: "tem_estacionamento", filtro: "estacionamento", label: "Tem estacionamento", curto: "Estacionamento", Icon: CarIcon },
  { key: "permite_coffee_office", filtro: "coffeeOffice", label: "Permite coffee office", curto: "Coffee office", Icon: LaptopIcon },
] as const satisfies ReadonlyArray<{
  key: keyof Cafe;
  filtro: FiltroBooleano;
  label: string;
  curto: string;
  Icon: unknown;
}>;

export function atributosDo(cafe: Cafe) {
  return ATRIBUTOS.filter(({ key }) => cafe[key]);
}

/** Filtros booleanos na ordem do design: o selo e os atributos, com os mesmos rótulos do card. */
export const FILTROS_DE_ATRIBUTO = [
  { filtro: "ascape", label: "Recife Coffee", curto: "Recife Coffee", Icon: CoffeeIcon },
  ...ATRIBUTOS,
] as const;
