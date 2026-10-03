import { BairroDropdown } from "@/components/bairro-dropdown";
import { BairroSheet } from "@/components/bairro-sheet";
import { FILTROS_DA_BARRA } from "@/components/cafe-atributos";
import { AtributoChip, chipClass } from "@/components/filter-chip";
import { MaisFiltrosDropdown } from "@/components/mais-filtros-dropdown";
import { BARRA_FILTROS } from "@/components/medidas";
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
 * linha — os selos e o estacionamento; os outros atributos ficam em "Mais
 * filtros" (desktop) e no sheet do botão de filtros (mobile). Desktop: 64 px,
 * bairro em dropdown. Mobile: chips de 36 px, bairro em bottom sheet.
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
      className={`${BARRA_FILTROS} scroll-px-[18px] overflow-x-auto [scrollbar-width:none] lg:scroll-px-7 [&::-webkit-scrollbar]:hidden`}
    >
      {FILTROS_DA_BARRA.map((opcao) => (
        <AtributoChip
          key={opcao.filtro}
          opcao={opcao}
          ativo={filters[opcao.filtro]}
          onToggle={() => onToggle(opcao.filtro)}
        />
      ))}
      <BairroSheet cafes={cafes} bairros={bairros} filters={filters} onAplicar={onAplicar} />
      <BairroDropdown
        bairros={bairros}
        selecionados={filters.bairros}
        onToggle={onToggleBairro}
        onLimpar={onLimparBairros}
      />
      <MaisFiltrosDropdown filters={filters} onToggle={onToggle} />
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
