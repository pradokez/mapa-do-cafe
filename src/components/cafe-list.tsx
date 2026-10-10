"use client";

import { useRef } from "react";

import { CafeCard, type CardHighlight } from "@/components/cafe-card";
import { EmptyCupIllustration } from "@/components/empty-cup-illustration";
import { LISTA_GRADE, LISTA_SECTION, LISTA_TOPO } from "@/components/medidas";
import { RodapeSugestoes } from "@/components/rodape-sugestoes";
import type { Cafe } from "@/lib/cafe";
import type { FestivaisNoAr } from "@/lib/festival";
import { contadorLabel } from "@/lib/format";

/**
 * Cards com a foto em `priority`: o que cabe de cara no mobile (lista) e nos
 * dois layouts do desktop (1 coluna até 1219 px, 2 depois). Mais que isso, o
 * preload disputaria banda com o CSS e o JS da página.
 */
const CARDS_PRIORITARIOS = 4;

/** Café em hover e de onde veio: do card (só eleva) ou do pin (eleva com borda). */
export type Hovered = { id: string; source: "card" | "pin" };

type Props = {
  cafes: Cafe[];
  /** Participantes dos festivais no ar: os selos dos cards. */
  festivais: FestivaisNoAr;
  hovered?: Hovered | null;
  /** Café com o preview aberto no mapa: card elevado com borda, como no hover do pin. */
  selectedId?: string | null;
  /** Hover ou foco num card (`null` ao sair). */
  onHover?: (id: string | null) => void;
  /** Presente só com filtro ativo: mostra "Limpar filtros" ao lado do contador. */
  onLimpar?: () => void;
};

export function CafeList({ cafes, festivais, hovered = null, selectedId = null, onHover, onLimpar }: Props) {
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
      className={`${LISTA_SECTION} focus:outline-none`}
    >
      <div className={LISTA_TOPO}>
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
        <>
          <EmptyState onLimpar={limpar} />
          <RodapeSugestoes frase="Sentiu falta de algo?" de="/" />
        </>
      ) : (
        <>
          <ul className={LISTA_GRADE}>
            {cafes.map((cafe, i) => (
              <li
                key={cafe.id}
                onMouseEnter={() => onHover?.(cafe.id)}
                onMouseLeave={() => onHover?.(null)}
                onFocus={() => onHover?.(cafe.id)}
                onBlur={() => onHover?.(null)}
              >
                <CafeCard cafe={cafe} festivais={festivais} highlight={highlightOf(cafe.id)} priority={i < CARDS_PRIORITARIOS} />
              </li>
            ))}
          </ul>
          <RodapeSugestoes frase="Tem uma ideia ou viu algo quebrado?" de="/" />
        </>
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
