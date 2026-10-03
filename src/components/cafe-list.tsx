import { CafeCard, type CardHighlight } from "@/components/cafe-card";
import type { Cafe } from "@/lib/cafe";
import { contadorLabel } from "@/lib/format";

/** Café em hover e de onde veio: do card (só eleva) ou do pin (eleva com borda). */
export type Hovered = { id: string; source: "card" | "pin" };

type Props = {
  cafes: Cafe[];
  hovered?: Hovered | null;
  /** Café com o preview aberto no mapa: card elevado com borda, como no hover do pin. */
  selectedId?: string | null;
  /** Hover ou foco num card (`null` ao sair). */
  onHover?: (id: string | null) => void;
};

export function CafeList({ cafes, hovered = null, selectedId = null, onHover }: Props) {
  const highlightOf = (id: string): CardHighlight | undefined => {
    if (id === selectedId || (id === hovered?.id && hovered.source === "pin")) return "linked";
    if (id === hovered?.id) return "lifted";
  };

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
            <CafeCard cafe={cafe} highlight={highlightOf(cafe.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
