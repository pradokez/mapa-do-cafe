"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type PointerEvent,
} from "react";

/**
 * shadcn/ui Sheet (Radix Dialog), só o lado de baixo e só as partes em uso,
 * com as medidas do bottom sheet do design (raio 24 px no topo, alça 40×4).
 * Foco preso, Esc e clique no fundo fecham, foco volta ao gatilho e ARIA
 * (`dialog` rotulado pelo título) vêm do Radix.
 *
 * Arrastar para baixo pela alça ou pelo título fecha pelo mesmo caminho de
 * Esc e do fundo (`onOpenChange(false)`). A lista rola normalmente: o gesto
 * só começa no topo. É um atalho de toque; teclado e leitor de tela seguem
 * fechando por Esc.
 */
const FecharContext = createContext<() => void>(() => {});

export function Sheet({ onOpenChange, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return (
    <FecharContext.Provider value={() => onOpenChange?.(false)}>
      <DialogPrimitive.Root onOpenChange={onOpenChange} {...props} />
    </FecharContext.Provider>
  );
}

export const SheetTrigger = DialogPrimitive.Trigger;

/** Marca as áreas de onde o arrasto pode começar. */
const ZONA_DE_ARRASTO = "data-sheet-arrasto";

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    {...{ [ZONA_DE_ARRASTO]: "" }}
    className={`mb-1.5 touch-none font-display text-[21px] text-espresso ${className}`}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

/** Fração da altura do sheet que, arrastada, fecha ao soltar. */
const LIMIAR = 0.25;
/** Velocidade (px/ms) do último movimento que fecha mesmo abaixo do limiar. */
const PETELECO = 0.5;
/** Abaixo disso, foi um toque, não um arrasto. */
const DESLOCAMENTO_MINIMO = 10;

type Arrasto = { inicioY: number; altura: number; y: number; t: number; velocidade: number };

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className = "", children, ...props }, ref) => {
  const fechar = useContext(FecharContext);
  const arrasto = useRef<Arrasto | null>(null);
  // `null` fora do arrasto: o sheet volta à posição com transição.
  const [puxado, setPuxado] = useState<{ dy: number; altura: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !(e.target as Element).closest(`[${ZONA_DE_ARRASTO}]`)) return;
    const altura = e.currentTarget.getBoundingClientRect().height;
    arrasto.current = { inicioY: e.clientY, altura, y: e.clientY, t: performance.now(), velocidade: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const t = performance.now();
    if (t > a.t) a.velocidade = (e.clientY - a.y) / (t - a.t);
    a.y = e.clientY;
    a.t = t;
    setPuxado({ dy: Math.max(0, e.clientY - a.inicioY), altura: a.altura });
  };
  const soltar = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    const dy = e.clientY - a.inicioY;
    const longe = dy > a.altura * LIMIAR;
    const peteleco = dy > DESLOCAMENTO_MINIMO && a.velocidade > PETELECO;
    if (e.type === "pointerup" && (longe || peteleco)) fechar();
    else setPuxado(null);
  };

  // O fundo clareia conforme o sheet desce (de 45% a ~15% de opacidade).
  const fundo = puxado ? 1 - (0.7 * Math.min(puxado.dy, puxado.altura)) / puxado.altura : 1;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-espresso/45" style={{ opacity: fundo }} />
      <DialogPrimitive.Content
        ref={ref}
        // Sem descrição: o título e as opções bastam.
        aria-describedby={undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{ transform: puxado ? `translateY(${puxado.dy}px)` : undefined }}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[24px] bg-cream px-[18px] pb-[26px] pt-2.5 focus:outline-none ${puxado ? "" : "transition-transform duration-200 motion-reduce:transition-none"} ${className}`}
        {...props}
      >
        {/* Alça 40×4 com área de toque de 24 px de altura, colada ao título (também arrastável). */}
        <div
          aria-hidden="true"
          {...{ [ZONA_DE_ARRASTO]: "" }}
          className="-mx-[18px] -mt-2.5 flex flex-none touch-none justify-center py-2.5"
        >
          <span className="h-1 w-10 rounded-full bg-chip-line" />
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
SheetContent.displayName = DialogPrimitive.Content.displayName;
