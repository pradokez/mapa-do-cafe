"use client";

import { useState } from "react";

import { CheckIcon } from "@/components/icons";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Cafe } from "@/lib/cafe";
import { filtrarCafes, type CafeFilters } from "@/lib/cafe-filter";

type Props = {
  titulo: string;
  /** Botão que abre o sheet; recebe o foco de volta ao fechar. */
  trigger: React.ReactElement;
  cafes: Cafe[];
  /** Filtros em vigor (a URL): o rascunho parte deles a cada abertura. */
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
  children: (rascunho: CafeFilters, mudar: (next: CafeFilters) => void) => React.ReactNode;
};

/**
 * Bottom sheet de filtro do mobile, com rascunho: marcar opções não mexe na
 * URL, e "Ver N cafés" já conta o resultado do rascunho. Só o botão aplica
 * (uma entrada no histórico); Esc ou toque no fundo descartam.
 */
export function FilterSheet({ titulo, trigger, cafes, filters, onAplicar, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(filters);

  const abrirOuFechar = (abrir: boolean) => {
    if (abrir) setRascunho(filters);
    setAberto(abrir);
  };
  // A busca não é do sheet: um termo que chega com ele aberto (debounce do
  // campo) vale para a contagem e não é desfeito ao aplicar.
  const efetivo = { ...rascunho, q: filters.q };
  const total = filtrarCafes(cafes, efetivo).length;

  return (
    <Sheet open={aberto} onOpenChange={abrirOuFechar}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetTitle>{titulo}</SheetTitle>
        <div className="-mx-[18px] min-h-0 overflow-y-auto px-[18px]">{children(rascunho, setRascunho)}</div>
        <button
          type="button"
          onClick={() => {
            onAplicar(efetivo);
            setAberto(false);
          }}
          className="mt-3.5 h-12 flex-none rounded-full bg-espresso text-[15px] font-semibold text-cream"
        >
          {total === 1 ? "Ver 1 café" : `Ver ${total} cafés`}
        </button>
      </SheetContent>
    </Sheet>
  );
}

type OptionProps = {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** Linha de 48 px do design: marca ✓ terracota à direita e semibold quando marcada. */
export function SheetOption({ checked, onToggle, children }: OptionProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex h-12 w-full items-center justify-between gap-3 border-b border-line px-1 text-left text-[15px] text-espresso outline-offset-[-2px] ${checked ? "font-semibold" : ""}`}
    >
      <span className="flex items-center gap-2.5">{children}</span>
      {checked && <CheckIcon size={18} strokeWidth={2.2} className="flex-none text-terracotta" />}
    </button>
  );
}
