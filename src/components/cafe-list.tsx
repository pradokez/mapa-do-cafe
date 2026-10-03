import { CafeCard } from "@/components/cafe-card";
import type { Cafe } from "@/lib/cafe";
import { contadorLabel } from "@/lib/format";

type Props = {
  cafes: Cafe[];
  /** Card com borda de destaque: pin em hover no mapa ou café selecionado. */
  highlightedId?: string | null;
  /** Hover ou foco num card (`null` ao sair). */
  onHover?: (id: string | null) => void;
};

export function CafeList({ cafes, highlightedId = null, onHover }: Props) {
  return (
    <section aria-label="Cafés" className="px-7 pb-8 pt-5">
      <p className="mb-4 flex min-h-6 items-center text-[13px] text-ink-3">
        {contadorLabel(cafes.length)}
      </p>
      <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
        {cafes.map((cafe) => (
          <li
            key={cafe.id}
            onMouseEnter={() => onHover?.(cafe.id)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(cafe.id)}
            onBlur={() => onHover?.(null)}
          >
            <CafeCard cafe={cafe} highlighted={cafe.id === highlightedId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
