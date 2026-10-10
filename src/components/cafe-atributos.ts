import {
  AccessibilityIcon,
  CarIcon,
  CoffeeIcon,
  HeartIcon,
  LaptopIcon,
  LeafIcon,
  PawIcon,
  SnowflakeIcon,
} from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import type { FiltroBooleano } from "@/lib/cafe-filter";
import type { FestivaisNoAr, FestivalSlug } from "@/lib/festival";

type Booleano = {
  key: string;
  filtro: FiltroBooleano;
  label: string;
  curto: string;
  Icon: unknown;
};

/**
 * Selos dos festivais, na ordem de exibição: pílula no card desktop, selinho
 * de ícone no mobile, badge e tag no detalhe, chip na barra e no sheet. Só
 * existem com a edição no ar (`FestivaisNoAr`), e só nos participantes.
 */
export const SELOS = [
  { key: "recife-coffee", filtro: "recifeCoffee", label: "Recife Coffee", curto: "Recife Coffee", Icon: CoffeeIcon },
  { key: "eu-amo-cafe", filtro: "euAmoCafe", label: "Eu Amo Café", curto: "Eu Amo Café", Icon: HeartIcon },
] as const satisfies ReadonlyArray<Booleano & { key: FestivalSlug }>;

/**
 * Atributos booleanos exibidos no card, nas tags do detalhe e como filtros
 * (`filtro`), na ordem do design. `curto`: rótulo visível do chip no mobile,
 * como no design; o rótulo acessível continua o `label`. Ar-condicionado
 * `null` (sem informação) não aparece, como `false`.
 */
export const ATRIBUTOS = [
  { key: "aceita_pets", filtro: "pets", label: "Aceita pets", curto: "Pets", Icon: PawIcon },
  { key: "tem_estacionamento", filtro: "estacionamento", label: "Tem estacionamento", curto: "Estacionamento", Icon: CarIcon },
  { key: "permite_coffee_office", filtro: "coffeeOffice", label: "Permite coffee office", curto: "Coffee office", Icon: LaptopIcon },
  { key: "acessivel_pcd", filtro: "pcd", label: "Acessível para PcD", curto: "Acessível", Icon: AccessibilityIcon },
  { key: "opcoes_vegetarianas", filtro: "vegetariano", label: "Opções vegetarianas", curto: "Vegetariano", Icon: LeafIcon },
  { key: "tem_ar_condicionado", filtro: "arCondicionado", label: "Ar-condicionado", curto: "Ar-condicionado", Icon: SnowflakeIcon },
] as const satisfies ReadonlyArray<Booleano & { key: keyof Cafe }>;

/** Selos dos festivais no ar, com ou sem participantes: os chips de filtro. */
export function selosNoAr(festivais: FestivaisNoAr) {
  return SELOS.filter(({ key }) => festivais[key] !== undefined);
}

/** Selos dos festivais no ar de que o café participa. */
export function selosDo(cafe: Cafe, festivais: FestivaisNoAr) {
  return SELOS.filter(({ key }) => festivais[key]?.includes(cafe.id));
}

export function atributosDo(cafe: Cafe) {
  return ATRIBUTOS.filter(({ key }) => cafe[key]);
}

/** Atributo com chip na barra (desktop e mobile), depois dos festivais no ar. */
const NA_BARRA: readonly FiltroBooleano[] = ["estacionamento"];

/** Chips da barra, na ordem do design: os festivais no ar e o estacionamento. */
export function filtrosDaBarra(festivais: FestivaisNoAr) {
  return [...selosNoAr(festivais), ...ATRIBUTOS.filter(({ filtro }) => NA_BARRA.includes(filtro))];
}

/** Os outros atributos: "Mais filtros" no desktop (no mobile, o sheet tem todos). */
export const MAIS_FILTROS = ATRIBUTOS.filter(({ filtro }) => !NA_BARRA.includes(filtro));
