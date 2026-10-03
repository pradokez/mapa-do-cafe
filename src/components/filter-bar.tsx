import { BairroDropdown } from "@/components/bairro-dropdown";
import { ATRIBUTOS } from "@/components/cafe-atributos";
import { chipClass } from "@/components/filter-chip";
import { CoffeeIcon } from "@/components/icons";
import type { FaixaPreco } from "@/lib/cafe";
import { FAIXAS, type BairroOpcao, type CafeFilters, type FiltroBooleano } from "@/lib/cafe-filter";
import { faixaPrecoNome } from "@/lib/format";

/** Chips na ordem do design: o selo e os atributos, com os mesmos rótulos do card. */
const CHIPS = [{ filtro: "ascape", label: "Recife Coffee", Icon: CoffeeIcon }, ...ATRIBUTOS] as const;

type Props = {
  filters: CafeFilters;
  bairros: BairroOpcao[];
  onToggle: (chave: FiltroBooleano) => void;
  onToggleBairro: (slug: string) => void;
  onLimparBairros: () => void;
  onTogglePreco: (faixa: FaixaPreco) => void;
};

/**
 * Barra de filtros da home: 64 px, chips em pílula. Abaixo de `lg` rola de
 * lado até o bottom sheet do mobile (#13) substituí-la.
 */
export function FilterBar({
  filters,
  bairros,
  onToggle,
  onToggleBairro,
  onLimparBairros,
  onTogglePreco,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Filtros"
      className="flex h-16 flex-none items-center gap-2 overflow-x-auto border-b border-line px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map(({ filtro, label, Icon }) => (
        <button
          key={filtro}
          type="button"
          aria-pressed={filters[filtro]}
          onClick={() => onToggle(filtro)}
          className={chipClass(filters[filtro], "gap-2 px-[15px] font-medium")}
        >
          <Icon size={16} strokeWidth={2} />
          {label}
        </button>
      ))}
      <BairroDropdown
        bairros={bairros}
        selecionados={filters.bairros}
        onToggle={onToggleBairro}
        onLimpar={onLimparBairros}
      />
      <span aria-hidden="true" className="mx-1.5 h-[22px] w-px flex-none bg-line-strong" />
      {FAIXAS.map((faixa) => (
        <button
          key={faixa}
          type="button"
          // "$" seria lido como "dólar": o nome da faixa é o rótulo.
          aria-label={faixaPrecoNome(faixa)}
          aria-pressed={filters.precos.includes(faixa)}
          onClick={() => onTogglePreco(faixa)}
          className={chipClass(
            filters.precos.includes(faixa),
            "min-w-[46px] justify-center px-[13px] font-semibold tracking-[.04em]",
          )}
        >
          {faixa}
        </button>
      ))}
    </div>
  );
}
