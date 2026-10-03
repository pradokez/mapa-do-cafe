"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  FILTROS_VAZIOS,
  parseFilters,
  serializeFilters,
  type CafeFilters,
  type FiltroBooleano,
} from "@/lib/cafe-filter";

/**
 * Estado de filtro da home, com a URL como única fonte — sem estado espelhado
 * nem `useEffect` de sincronização.
 *
 * Escreve com `history.pushState`, não `router.push`: a home é dinâmica, e
 * `router.push` refaria o render no servidor a cada clique num chip. O Next
 * (≥ 14.1) propaga o `pushState` para `useSearchParams` sem round-trip, e cada
 * mudança vira uma entrada no histórico (voltar/avançar desfaz/refaz).
 */
export function useFilterParams() {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const navigate = (next: CafeFilters) => {
    const query = serializeFilters(next, new URLSearchParams(searchParams.toString())).toString();
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
  };

  return {
    filters,
    toggle: (chave: FiltroBooleano) => navigate({ ...filters, [chave]: !filters[chave] }),
    limpar: () => navigate(FILTROS_VAZIOS),
  };
}
