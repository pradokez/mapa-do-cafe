"use client";

import { useRef } from "react";

import { CafeCard, type CardHighlight } from "@/components/cafe-card";
import { EmptyCupIllustration } from "@/components/empty-cup-illustration";
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
  /** Presente só com filtro ativo: mostra "Limpar filtros" ao lado do contador. */
  onLimpar?: () => void;
};

export function CafeList({ cafes, hovered = null, selectedId = null, onHover, onLimpar }: Props) {
  const highlightOf = (id: string): CardHighlight | undefined => {
    if (id === selectedId || (id === hovered?.id && hovered.source === "pin")) return "linked";
    if (id === hovered?.id) return "lifted";
  };

  // O botão clicado some junto com o recorte; sem isso o foco cairia no <body>.
  const sectionRef = useRef<HTMLElement>(null);
  const limpar =
    onLimpar &&
    (() => {
      onLimpar();
      sectionRef.current?.focus();
    });

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label="Cafés"
      className="flex min-h-full flex-col px-4 pb-[110px] pt-3.5 focus:outline-none lg:px-7 lg:pb-8 lg:pt-5"
    >
      <div className="mb-2.5 flex min-h-6 items-center justify-between gap-4 px-0.5 lg:mb-4 lg:px-0">
        <p aria-live="polite" className="text-[12.5px] text-ink-3 lg:text-[13px]">{contadorLabel(cafes.length)}</p>
        {limpar && (
          <button
            type="button"
            onClick={limpar}
            className="text-[13px] font-medium text-espresso underline underline-offset-[3px]"
          >
            Limpar filtros
          </button>
        )}
      </div>
      {cafes.length === 0 ? (
        <EmptyState onLimpar={limpar} />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:gap-[18px]">
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
      )}
    </section>
  );
}

/**
 * "Xícara vazia por aqui": o recorte não achou nada. Medidas da tela 04 do
 * design (centralizado na coluna, com respiro maior embaixo). Abaixo de `lg`
 * o design não tem título; aqui fica a mesma composição, menor e no topo.
 */
function EmptyState({ onLimpar }: { onLimpar?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3.5 py-12 text-center lg:justify-center lg:px-5 lg:pb-[120px] lg:pt-0">
      <EmptyCupIllustration className="w-[110px] text-espresso lg:w-[148px]" />
      <h2 className="font-display text-2xl text-espresso lg:text-[28px]">Xícara vazia por aqui</h2>
      <p className="max-w-[360px] text-[15px] leading-[1.55] text-ink-2">
        Nenhum café encontrado com esses filtros. Que tal explorar outros bairros?
      </p>
      {onLimpar && (
        <button
          type="button"
          onClick={onLimpar}
          className="mt-2 h-11 rounded-full bg-terracotta px-[22px] text-[14.5px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
