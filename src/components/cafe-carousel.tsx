"use client";

import { useRef, useState } from "react";

import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { CARROSSEL } from "@/components/medidas";
import type { PhotoSource } from "@/lib/cafe-photos";

// Deslocamento horizontal mínimo para um toque contar como swipe.
const SWIPE_PX = 40;

const ARROW =
  "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[.92] text-espresso shadow-[0_4px_12px_rgba(44,26,14,.18)] transition-colors hover:bg-white";

/**
 * Hero do detalhe (padrão de carrossel do WAI-ARIA APG, sem rotação
 * automática). Recebe as fotos já resolvidas por `cafe-photos`; só decide
 * qual slot está à vista. Setas, dots, ←/→ e swipe dão a volta nas pontas.
 */
export function CafeCarousel({ photos, nome }: { photos: PhotoSource[]; nome: string }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const total = photos.length;
  const go = (i: number) => setIndex((i + total) % total);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={`Fotos de ${nome}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        else if (e.key === "ArrowRight") go(index + 1);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - start.y)) {
          go(dx < 0 ? index + 1 : index - 1);
        }
      }}
      className={CARROSSEL}
    >
      <div
        className="flex size-full transition-transform duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((photo, k) => (
          <CafePhotoFrame
            key={k}
            photo={photo}
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} de ${total}`}
            aria-hidden={k !== index}
            className="flex h-full flex-[0_0_100%] items-end px-[26px] pb-10 pt-[22px] lg:pb-[22px]"
          >
            {/* Abaixo de lg a legenda sobe acima dos dots: na largura do celular, os dois se encostariam. */}
            {photo.kind === "placeholder" && (
              <span aria-hidden="true" className="text-[11.5px] uppercase tracking-[.1em] text-espresso/55">
                foto · {nome}
              </span>
            )}
          </CafePhotoFrame>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(index - 1)}
            className={`${ARROW} left-[18px]`}
          >
            <ChevronLeftIcon size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => go(index + 1)}
            className={`${ARROW} right-[18px]`}
          >
            <ChevronRightIcon size={18} strokeWidth={2} />
          </button>

          {/* O contador visual fica fora da árvore de acessibilidade: quem
              anuncia a troca é o live region, já que slide de placeholder
              não tem texto acessível (legenda decorativa, img com alt=""). */}
          <span aria-live="polite" className="sr-only">
            Foto {index + 1} de {total}
          </span>
          <span
            aria-hidden="true"
            className="absolute right-[18px] top-[18px] flex h-7 items-center rounded-full bg-espresso/[.78] px-3 text-[12.5px] font-semibold text-cream"
          >
            {index + 1} / {total}
          </span>

          {/* Alvo de toque maior que o dot de 7 px, via padding transparente. */}
          <div className="absolute bottom-[11px] left-1/2 flex -translate-x-1/2 items-center">
            {photos.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Foto ${k + 1} de ${total}`}
                aria-current={k === index}
                onClick={() => go(k)}
                className="flex h-[25px] items-center rounded-full px-[3px]"
              >
                <span
                  className={`block h-[7px] rounded-full transition-all duration-[250ms] motion-reduce:transition-none ${
                    k === index ? "w-5 bg-espresso" : "w-[7px] bg-espresso/[.28]"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
