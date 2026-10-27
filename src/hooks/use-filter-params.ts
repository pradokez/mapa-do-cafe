"use client";

import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { FaixaPreco } from "@/lib/cafe";
import type { RaioKm } from "@/lib/cafe-distance";
import {
  alternar,
  FILTROS_VAZIOS,
  parseFilters,
  serializeFilters,
  type CafeFilters,
  type FiltroBooleano,
} from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

/**
 * Estado de filtro da home, com a URL como única fonte — sem estado espelhado
 * nem `useEffect` de sincronização.
 *
 * Escreve com `history.pushState`, não `router.push`: a home é dinâmica, e
 * `router.push` refaria o render no servidor a cada clique num chip. O Next
 * (≥ 14.1) propaga o `pushState` para `useSearchParams` sem round-trip, e cada
 * mudança vira uma entrada no histórico (voltar/avançar desfaz/refaz). A busca
 * é a exceção: usa `replaceState`, para "voltar" não desfazer letra por letra.
 *
 * O raio de distância (#161) é a exceção à URL: estado local, como a visão
 * lista/mapa — fora do histórico, e recarregar desliga. Mudar só ele não
 * cria entrada no histórico.
 */
export function useFilterParams(bairrosValidos: readonly string[], festivais: FestivaisNoAr) {
  const searchParams = useSearchParams();
  const [raioKm, setRaioKm] = useState<RaioKm | null>(null);
  // Slug desconhecido e festival fora do ar saem do estado — e da URL no próximo clique.
  const filters = useMemo(
    () => ({ ...parseFilters(searchParams, { bairros: bairrosValidos, festivais }), raioKm }),
    [searchParams, bairrosValidos, festivais, raioKm],
  );

  const navigate = (next: CafeFilters) => {
    setRaioKm(next.raioKm);
    escrever(searchParams, next, "push");
  };
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
    escolherRaio: (km: RaioKm | null) => setRaioKm(km),
    /** Aplica um estado inteiro de uma vez (os bottom sheets): uma entrada no histórico. */
    aplicar: navigate,
    limpar: () => navigate(FILTROS_VAZIOS),
  };
}

function escrever(atual: ReadonlyURLSearchParams, next: CafeFilters, modo: "push" | "replace") {
  const query = serializeFilters(next, new URLSearchParams(atual.toString()));
  // Sem mudança na URL (só o raio mudou, ou um sheet aplicado sem mexer), nada no histórico.
  if (query === window.location.search.slice(1)) return;
  const url = query ? `?${query}` : window.location.pathname;
  if (modo === "replace") window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
