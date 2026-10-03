"use client";

import { useId } from "react";

import { ATRIBUTOS, SELOS } from "@/components/cafe-atributos";
import { chipClass } from "@/components/filter-chip";
import { RascunhoSheet, SheetOption } from "@/components/rascunho-sheet";
import { SlidersIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { alternar, contarFiltrosAtivos, FAIXAS, type CafeFilters, type FiltroBooleano } from "@/lib/cafe-filter";
import { faixaPrecoNome } from "@/lib/format";

type Props = {
  cafes: Cafe[];
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
};

/**
 * Botão de filtros do header mobile (com badge) + bottom sheet em seções:
 * selos e comodidades em chips (como no design v2), faixa de preço em linhas
 * (o chip "$" sozinho perderia o nome). Desvio consciente do design, em que o
 * botão abria o mesmo sheet do bairro: o bairro fica no próprio chip
 * (`BairroSheet`).
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
      {(rascunho, mudar) => {
        const alternarFiltro = (filtro: FiltroBooleano) => mudar({ ...rascunho, [filtro]: !rascunho[filtro] });
        return (
          <>
            <Secao titulo="Selos">
              <Chips opcoes={SELOS} rascunho={rascunho} onToggle={alternarFiltro} />
            </Secao>
            <Secao titulo="Comodidades">
              <Chips opcoes={ATRIBUTOS} rascunho={rascunho} onToggle={alternarFiltro} />
            </Secao>
            <Secao titulo="Faixa de preço">
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
            </Secao>
          </>
        );
      }}
    </RascunhoSheet>
  );
}

/** Seção do sheet: título de 11,5 px em caixa alta (`ink-3`), que dá nome ao grupo. */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="mb-5 last:mb-0">
      <h3 id={id} className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[.12em] text-ink-3">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

type ChipsProps = {
  opcoes: typeof SELOS | typeof ATRIBUTOS;
  rascunho: CafeFilters;
  onToggle: (filtro: FiltroBooleano) => void;
};

/** Chips de 36 px da barra, com o rótulo curto visível e o inteiro como nome acessível. */
function Chips({ opcoes, rascunho, onToggle }: ChipsProps) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {opcoes.map(({ filtro, label, curto, Icon }) => (
        <button
          key={filtro}
          type="button"
          aria-label={label}
          aria-pressed={rascunho[filtro]}
          onClick={() => onToggle(filtro)}
          className={chipClass(rascunho[filtro], "gap-1.5 px-[13px] font-medium")}
        >
          <Icon size={15} strokeWidth={2} />
          {curto}
        </button>
      ))}
    </div>
  );
}
