import { CarIcon, LaptopIcon, PawIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";

/** Atributos booleanos exibidos no card e nas tags do detalhe, na ordem do design. */
export const ATRIBUTOS = [
  { key: "aceita_pets", label: "Aceita pets", Icon: PawIcon },
  { key: "tem_estacionamento", label: "Tem estacionamento", Icon: CarIcon },
  { key: "permite_coffee_office", label: "Permite coffee office", Icon: LaptopIcon },
] as const satisfies ReadonlyArray<{ key: keyof Cafe; label: string; Icon: unknown }>;

export function atributosDo(cafe: Cafe) {
  return ATRIBUTOS.filter(({ key }) => cafe[key]);
}
