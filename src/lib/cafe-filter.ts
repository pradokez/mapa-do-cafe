import type { Cafe } from "./cafe";

/** Filtros booleanos: chave do estado → campo do café e param da URL (`?pets=true`). */
const FILTROS_BOOLEANOS = {
  ascape: { campo: "selo_ascape", param: "ascape" },
  pets: { campo: "aceita_pets", param: "pets" },
  estacionamento: { campo: "tem_estacionamento", param: "estacionamento" },
  coffeeOffice: { campo: "permite_coffee_office", param: "coffee_office" },
} as const satisfies Record<string, { campo: keyof Cafe; param: string }>;

export type FiltroBooleano = keyof typeof FILTROS_BOOLEANOS;

export type CafeFilters = Record<FiltroBooleano, boolean>;

export const FILTROS_VAZIOS: CafeFilters = {
  ascape: false,
  pets: false,
  estacionamento: false,
  coffeeOffice: false,
};

const CHAVES = Object.keys(FILTROS_BOOLEANOS) as FiltroBooleano[];

/** Interseção dos filtros ligados; filtro desligado não exclui ninguém. Preserva a ordem. */
export function filtrarCafes(cafes: Cafe[], filters: CafeFilters): Cafe[] {
  const ligados = CHAVES.filter((chave) => filters[chave]);
  return cafes.filter((cafe) => ligados.every((chave) => cafe[FILTROS_BOOLEANOS[chave].campo]));
}

/** Leitura mínima de params: `URLSearchParams` e o `useSearchParams()` do Next. */
type ParamsLike = Pick<URLSearchParams, "get">;

export function parseFilters(params: ParamsLike): CafeFilters {
  const filters = { ...FILTROS_VAZIOS };
  for (const chave of CHAVES) {
    filters[chave] = params.get(FILTROS_BOOLEANOS[chave].param) === "true";
  }
  return filters;
}

/**
 * Escreve os filtros sobre uma cópia de `base`: params de filtro são
 * reescritos (só os ligados, `=true`); os alheios (`utm_*`, os de filtros
 * futuros) ficam como estavam.
 */
export function serializeFilters(filters: CafeFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const chave of CHAVES) {
    const { param } = FILTROS_BOOLEANOS[chave];
    if (filters[chave]) params.set(param, "true");
    else params.delete(param);
  }
  return params;
}

/** Algum filtro ligado? Decide se "Limpar filtros" aparece. */
export function temFiltroAtivo(filters: CafeFilters): boolean {
  return CHAVES.some((chave) => filters[chave]);
}
