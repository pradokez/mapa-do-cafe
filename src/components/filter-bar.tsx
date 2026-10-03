import { CarIcon, CoffeeIcon, LaptopIcon, PawIcon } from "@/components/icons";
import type { CafeFilters, FiltroBooleano } from "@/lib/cafe-filter";

/** Chips na ordem e com os rótulos do design. */
const CHIPS = [
  { chave: "ascape", label: "Recife Coffee", Icon: CoffeeIcon },
  { chave: "pets", label: "Aceita pets", Icon: PawIcon },
  { chave: "estacionamento", label: "Tem estacionamento", Icon: CarIcon },
  { chave: "coffeeOffice", label: "Permite coffee office", Icon: LaptopIcon },
] as const satisfies ReadonlyArray<{ chave: FiltroBooleano; label: string; Icon: unknown }>;

const CHIP =
  "inline-flex h-[38px] flex-none items-center gap-2 rounded-full border px-[15px] text-[13.5px] font-medium transition-colors duration-200 motion-reduce:transition-none";
const CHIP_ON = "border-terracotta bg-terracotta text-on-terracotta hover:border-terracotta-hover hover:bg-terracotta-hover";
const CHIP_OFF = "border-chip-line text-espresso hover:bg-hover-soft";

type Props = {
  filters: CafeFilters;
  onToggle: (chave: FiltroBooleano) => void;
};

/**
 * Barra de filtros da home: 64 px, chips em pílula. Abaixo de `lg` rola de
 * lado até o bottom sheet do mobile (#13) substituí-la.
 */
export function FilterBar({ filters, onToggle }: Props) {
  return (
    <div
      role="group"
      aria-label="Filtros"
      className="flex h-16 flex-none items-center gap-2 overflow-x-auto border-b border-line px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map(({ chave, label, Icon }) => (
        <button
          key={chave}
          type="button"
          aria-pressed={filters[chave]}
          onClick={() => onToggle(chave)}
          className={`${CHIP} ${filters[chave] ? CHIP_ON : CHIP_OFF}`}
        >
          <Icon size={16} strokeWidth={2} />
          {label}
        </button>
      ))}
    </div>
  );
}
