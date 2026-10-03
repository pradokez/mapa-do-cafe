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

type Booleano = {
  key: keyof Cafe;
  filtro: FiltroBooleano;
  label: string;
  curto: string;
  Icon: unknown;
};

/** Selos, na ordem de exibição: pílula no card desktop, selinho de ícone no mobile, badge e tag no detalhe. */
export const SELOS = [
  { key: "selo_ascape", filtro: "ascape", label: "Recife Coffee", curto: "Recife Coffee", Icon: CoffeeIcon },
  { key: "selo_eu_amo_cafe", filtro: "euAmoCafe", label: "Eu Amo Café", curto: "Eu Amo Café", Icon: HeartIcon },
] as const satisfies ReadonlyArray<Booleano>;

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
] as const satisfies ReadonlyArray<Booleano>;

export function selosDo(cafe: Cafe) {
  return SELOS.filter(({ key }) => cafe[key]);
}

export function atributosDo(cafe: Cafe) {
  return ATRIBUTOS.filter(({ key }) => cafe[key]);
}

/** Filtros booleanos na ordem do design: os selos e os atributos, com os mesmos rótulos do card. */
const FILTROS_DE_ATRIBUTO = [...SELOS, ...ATRIBUTOS];

/** Chips da barra (desktop e mobile); os outros ficam em "Mais filtros" (desktop) e no sheet (mobile). */
const NA_BARRA: readonly FiltroBooleano[] = ["ascape", "euAmoCafe", "estacionamento"];

export const FILTROS_DA_BARRA = FILTROS_DE_ATRIBUTO.filter(({ filtro }) => NA_BARRA.includes(filtro));

export const MAIS_FILTROS = FILTROS_DE_ATRIBUTO.filter(({ filtro }) => !NA_BARRA.includes(filtro));
