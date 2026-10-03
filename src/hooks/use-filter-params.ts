"use client";

import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { FaixaPreco } from "@/lib/cafe";
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
 * mudança vira uma entrada no histórico (voltar/avançar desfaz/refaz). A busca
 * é a exceção: usa `replaceState`, para "voltar" não desfazer letra por letra.
 */
export function useFilterParams(bairrosValidos: readonly string[]) {
  const searchParams = useSearchParams();
  // Slug desconhecido sai do estado — e da URL no próximo clique.
  const filters = useMemo(
    () => parseFilters(searchParams, bairrosValidos),
    [searchParams, bairrosValidos],
  );

  const navigate = (next: CafeFilters) => escrever(searchParams, next, "push");
  // Estável enquanto a URL não muda: o debounce do campo reinicia quando ela muda.
  const buscar = useCallback(
    (q: string) => escrever(searchParams, { ...filters, q }, "replace"),
    [searchParams, filters],
  );

  return {
    filters,
    toggle: (chave: FiltroBooleano) => navigate({ ...filters, [chave]: !filters[chave] }),
    toggleBairro: (slug: string) => navigate({ ...filters, bairros: alternar(filters.bairros, slug) }),
    limparBairros: () => navigate({ ...filters, bairros: [] }),
    togglePreco: (faixa: FaixaPreco) => navigate({ ...filters, precos: alternar(filters.precos, faixa) }),
    buscar,
    limpar: () => navigate(FILTROS_VAZIOS),
  };
}

function escrever(atual: ReadonlyURLSearchParams, next: CafeFilters, modo: "push" | "replace") {
  const query = serializeFilters(next, new URLSearchParams(atual.toString()));
  const url = query ? `?${query}` : window.location.pathname;
  if (modo === "replace") window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Tira o valor se está na lista, põe se não está. A ordem canônica é do `serializeFilters`. */
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}
