import { BairroDropdown } from "@/components/bairro-dropdown";
import { BairroSheet } from "@/components/bairro-sheet";
import { FILTROS_DE_ATRIBUTO } from "@/components/cafe-atributos";
import { chipClass } from "@/components/filter-chip";
import type { Cafe, FaixaPreco } from "@/lib/cafe";
import { FAIXAS, type BairroOpcao, type CafeFilters, type FiltroBooleano } from "@/lib/cafe-filter";
import { faixaPrecoNome } from "@/lib/format";

type Props = {
  /** Todos os cafés: o sheet de bairro conta o resultado do rascunho. */
  cafes: Cafe[];
  filters: CafeFilters;
  bairros: BairroOpcao[];
  onToggle: (chave: FiltroBooleano) => void;
  onToggleBairro: (slug: string) => void;
  onLimparBairros: () => void;
  onTogglePreco: (faixa: FaixaPreco) => void;
  onAplicar: (next: CafeFilters) => void;
};

/**
 * Barra de filtros da home: chips em pílula com scroll lateral, sem quebrar
 * linha. Desktop: 64 px, bairro em dropdown. Mobile: chips de 36 px, bairro
 * em bottom sheet.
 */
export function FilterBar({
  cafes,
  filters,
  bairros,
  onToggle,
  onToggleBairro,
  onLimparBairros,
  onTogglePreco,
  onAplicar,
}: Props) {
  return (
    // O chip focado rola para dentro com a folga do padding (scroll-px). O
    // scrollIntoView é explícito porque o Chrome não rola chip já visível em parte.
    <div
      role="group"
      aria-label="Filtros"
      onFocus={(e) => e.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className="flex flex-none scroll-px-[18px] items-center gap-[7px] overflow-x-auto border-b border-line px-[18px] pb-3 pt-1.5 [scrollbar-width:none] lg:h-16 lg:scroll-px-7 lg:gap-2 lg:px-7 lg:py-0 [&::-webkit-scrollbar]:hidden"
    >
      {FILTROS_DE_ATRIBUTO.map(({ filtro, label, curto, Icon }) => (
        <button
          key={filtro}
          type="button"
          // O nome acessível é sempre o rótulo inteiro, que contém o curto visível.
          aria-label={label}
          aria-pressed={filters[filtro]}
          onClick={() => onToggle(filtro)}
          className={chipClass(filters[filtro], "gap-1.5 px-[13px] font-medium lg:gap-2 lg:px-[15px]")}
        >
          <Icon size={16} strokeWidth={2} />
          <span className="lg:hidden">{curto}</span>
          <span className="hidden lg:inline">{label}</span>
        </button>
      ))}
      <BairroSheet cafes={cafes} bairros={bairros} filters={filters} onAplicar={onAplicar} />
      <BairroDropdown
        bairros={bairros}
        selecionados={filters.bairros}
        onToggle={onToggleBairro}
        onLimpar={onLimparBairros}
      />
      <span aria-hidden="true" className="mx-1.5 hidden h-[22px] w-px flex-none bg-line-strong lg:block" />
      {FAIXAS.map((faixa) => {
        const ativo = filters.precos.includes(faixa);
        return (
          <button
            key={faixa}
            type="button"
            // "$" seria lido como "dólar": o nome da faixa é o rótulo.
            aria-label={faixaPrecoNome(faixa)}
            aria-pressed={ativo}
            onClick={() => onTogglePreco(faixa)}
            className={chipClass(ativo, "min-w-[42px] justify-center px-[11px] font-semibold tracking-[.04em] lg:min-w-[46px] lg:px-[13px]")}
          >
            {faixa}
          </button>
        );
      })}
    </div>
  );
}
