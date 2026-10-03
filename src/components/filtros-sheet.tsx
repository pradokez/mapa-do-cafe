"use client";

import { FILTROS_DE_ATRIBUTO } from "@/components/cafe-atributos";
import { RascunhoSheet, SheetOption } from "@/components/rascunho-sheet";
import { SlidersIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { alternar, contarFiltrosAtivos, FAIXAS, type CafeFilters } from "@/lib/cafe-filter";
import { faixaPrecoNome } from "@/lib/format";

type Props = {
  cafes: Cafe[];
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
};

/**
 * Botão de filtros do header mobile (com badge) + bottom sheet com o selo, os
 * atributos e a faixa de preço. Desvio consciente do design, em que o botão
 * abria o sheet de bairro: o bairro fica no próprio chip (`BairroSheet`).
 */
export function FiltrosSheet({ cafes, filters, onAplicar }: Props) {
  const ativos = contarFiltrosAtivos(filters);

  return (
    <RascunhoSheet
      titulo="Filtros"
      cafes={cafes}
      filters={filters}
      onAplicar={onAplicar}
      trigger={
        <button
          type="button"
          aria-label={ativos === 0 ? "Filtros" : `Filtros, ${ativos} ${ativos === 1 ? "ativo" : "ativos"}`}
          className="relative flex size-11 flex-none items-center justify-center rounded-full border border-line-strong bg-white text-espresso transition-colors hover:bg-hover-soft"
        >
          <SlidersIcon size={18} strokeWidth={2} />
          {ativos > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-cream bg-terracotta px-1 text-[10.5px] font-bold text-on-terracotta"
            >
              {ativos}
            </span>
          )}
        </button>
      }
    >
      {(rascunho, mudar) => (
        <>
          {FILTROS_DE_ATRIBUTO.map(({ filtro, label, Icon }) => (
            <SheetOption
              key={filtro}
              checked={rascunho[filtro]}
              onToggle={() => mudar({ ...rascunho, [filtro]: !rascunho[filtro] })}
            >
              <Icon size={18} strokeWidth={1.9} className="text-ink-2" />
              {label}
            </SheetOption>
          ))}
          <h3 className="mb-1 mt-5 px-1 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">
            Faixa de preço
          </h3>
          {FAIXAS.map((faixa) => (
            <SheetOption
              key={faixa}
              checked={rascunho.precos.includes(faixa)}
              onToggle={() => mudar({ ...rascunho, precos: alternar(rascunho.precos, faixa) })}
            >
              {/* "$" seria lido como "dólar": o nome da faixa é o rótulo. */}
              <span aria-hidden="true" className="w-[30px] font-semibold tracking-[.04em]">
                {faixa}
              </span>{" "}
              {faixaPrecoNome(faixa)}
            </SheetOption>
          ))}
        </>
      )}
    </RascunhoSheet>
  );
}
