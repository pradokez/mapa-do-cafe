"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRef } from "react";

import { FotoDoStorage } from "@/components/foto-do-storage";
import { ChevronLeftIcon, ChevronRightIcon, NavigationIcon, XIcon } from "@/components/icons";
import { caminhoDoCafe } from "@/lib/cafe";
import { fonteDaArte, type Combo } from "@/lib/festival";
import { googleMapsUrl } from "@/lib/format";

// Deslocamento horizontal mínimo para um arraste contar (o mesmo do carrossel).
const SWIPE_PX = 40;

const SETA =
  "flex size-12 flex-none items-center justify-center rounded-full bg-cream/[.14] text-cream transition-colors hover:bg-cream/[.24] focus-visible:outline-cream max-lg:sr-only";

type Props = {
  combos: Combo[];
  /** Posição do combo aberto em `combos`; `null` fecha. */
  indice: number | null;
  onIndice: (indice: number | null) => void;
  /** Ao fechar, para onde vai o foco: o card do combo à vista, não o que abriu. */
  onFechado: (indice: number) => void;
  festival: string;
  ano: number;
  encerrada: boolean;
};

/**
 * Arte ampliada da página do festival (design 5a/5b). Radix Dialog: foco preso,
 * Esc e clique fora fecham. Setas (botões e ←/→) passam os combos com volta
 * nas pontas; no mobile, arrastar a arte para o lado faz o mesmo e as setas
 * ficam só para leitor de tela (`sr-only`).
 */
export function FestivalArteAmpliada({ combos, indice, onIndice, onFechado, festival, ano, encerrada }: Props) {
  const ultimo = useRef(0);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const total = combos.length;
  const combo = indice !== null ? combos[indice] : undefined;
  if (indice !== null) ultimo.current = indice;

  const ir = (passo: number) => {
    if (indice !== null) onIndice((indice + passo + total) % total);
  };

  return (
    <DialogPrimitive.Root open={combo !== undefined} onOpenChange={(aberto) => !aberto && onIndice(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-lightbox lg:bg-lightbox/90" />
        {combo && (
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              onFechado(ultimo.current);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") ir(-1);
              else if (e.key === "ArrowRight") ir(1);
            }}
            // O conteúdo cobre a tela (no desktop, transparente): clique fora do cartão fecha.
            onClick={(e) => e.target === e.currentTarget && onIndice(null)}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-lightbox text-cream outline-none lg:flex-row lg:items-center lg:justify-center lg:gap-5 lg:overflow-hidden lg:bg-transparent lg:p-6"
          >
            <DialogPrimitive.Title className="sr-only">
              {combo.cafe.nome}, combo {indice! + 1} de {total}
            </DialogPrimitive.Title>
            <p aria-hidden="true" className="flex h-[68px] flex-none items-end px-[18px] pb-3 text-[13px] text-sobre-espresso-2 lg:hidden">
              {indice! + 1} de {total}
            </p>

            <button type="button" onClick={() => ir(-1)} aria-label="Combo anterior" className={SETA}>
              <ChevronLeftIcon size={20} strokeWidth={2} />
            </button>

            <div className="flex flex-1 flex-col lg:flex-none lg:flex-row lg:overflow-hidden lg:rounded-2xl lg:bg-cream lg:text-espresso lg:shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)]">
              <Arte
                combo={combo}
                encerrada={encerrada}
                onPointerDown={(e) => (inicio.current = { x: e.clientX, y: e.clientY })}
                onPointerUp={(e) => {
                  const de = inicio.current;
                  inicio.current = null;
                  if (!de) return;
                  const dx = e.clientX - de.x;
                  if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - de.y)) ir(dx < 0 ? 1 : -1);
                }}
              />
              <div aria-hidden="true" className="flex flex-wrap justify-center gap-1.5 px-[18px] pt-3 lg:hidden">
                {combos.map(({ participacao }, k) => (
                  <span
                    key={participacao.id}
                    className={`size-1.5 rounded-full ${k === indice ? "bg-cream" : "bg-cream/30"}`}
                  />
                ))}
              </div>

              <div className="flex flex-1 flex-col gap-1 px-[18px] pb-[30px] pt-3.5 lg:w-[300px] lg:flex-none lg:gap-2.5 lg:px-[26px] lg:py-7">
                <p aria-hidden="true" className="hidden text-[12.5px] text-ink-3 lg:block">
                  {indice! + 1} de {total}
                </p>
                <p className="font-display text-[22px] leading-[1.1] lg:text-[28px]">{combo.cafe.nome}</p>
                <p className="text-[13.5px] leading-normal text-sobre-espresso-2 lg:text-sm lg:text-ink-2">
                  {combo.cafe.bairro} · {combo.cafe.endereco}
                </p>
                {encerrada && (
                  <p className="mt-1.5 text-[13px] text-sobre-espresso-2 lg:text-ink-3">
                    Combo da edição {ano}, não está mais à venda.
                  </p>
                )}
                <p className="mt-0.5 text-[11.5px] text-sobre-espresso-2 lg:mb-1 lg:mt-auto lg:text-xs lg:text-ink-3">
                  Arte: {festival}
                </p>
                <div className="mt-auto flex gap-2 pt-4 lg:mt-0 lg:flex-col lg:pt-0">
                  <Link
                    href={caminhoDoCafe(combo.cafe)}
                    className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-cream text-[15px] font-semibold text-espresso max-lg:focus-visible:outline-cream lg:h-[46px] lg:flex-none lg:bg-terracotta lg:text-[14.5px] lg:text-on-terracotta lg:hover:bg-terracotta-hover"
                  >
                    Ver café
                  </Link>
                  <a
                    href={googleMapsUrl(combo.cafe)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border border-cream/30 text-[15px] font-semibold text-cream max-lg:focus-visible:outline-cream lg:h-[46px] lg:flex-none lg:border-line-strong lg:bg-white lg:text-[14.5px] lg:text-espresso lg:hover:bg-hover-soft"
                  >
                    <NavigationIcon strokeWidth={2} />
                    Como chegar
                  </a>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => ir(1)} aria-label="Próximo combo" className={SETA}>
              <ChevronRightIcon size={20} strokeWidth={2} />
            </button>

            <DialogPrimitive.Close
              aria-label="Fechar"
              className="absolute right-3.5 top-3 flex size-11 items-center justify-center rounded-full bg-cream/[.14] text-cream focus-visible:outline-cream lg:right-6 lg:top-6 lg:bg-cream lg:text-espresso"
            >
              <XIcon size={18} strokeWidth={2.2} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** A arte inteira, sem corte (o texto do combo está nela); sem arte, o placeholder. */
function Arte({
  combo,
  encerrada,
  ...gesto
}: { combo: Combo; encerrada: boolean } & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerUp"
>) {
  const fonte = fonteDaArte(combo);
  return (
    <div
      {...gesto}
      className={`relative aspect-[4/5] w-full flex-none touch-pan-y select-none lg:h-[min(650px,calc(100dvh-48px))] lg:w-auto ${encerrada ? "grayscale-[.6]" : ""}`}
      style={fonte.kind === "placeholder" ? { background: fonte.background } : undefined}
    >
      {fonte.kind === "url" && (
        <FotoDoStorage
          src={fonte.src}
          alt={combo.participacao.alt ?? ""}
          fill
          sizes="(min-width: 1024px) 520px, 100vw"
          draggable={false}
          className="object-contain"
        />
      )}
    </div>
  );
}
