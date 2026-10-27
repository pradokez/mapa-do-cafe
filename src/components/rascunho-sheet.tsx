"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { CheckIcon } from "@/components/icons";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Cafe } from "@/lib/cafe";
import { proximoPelaSeta } from "@/components/radio-setas";
import { OPCOES_DE_RAIO, raioLabel, type Coordenadas, type RaioKm } from "@/lib/cafe-distance";
import { filtrarCafes, type CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

type Props = {
  titulo: string;
  /** Botão que abre o sheet; recebe o foco de volta ao fechar. */
  trigger: React.ReactElement;
  cafes: Cafe[];
  /** Participantes dos festivais no ar: o filtro de festival conta para o "Ver N cafés". */
  festivais: FestivaisNoAr;
  /** Posição do navegador: o raio conta para o "Ver N cafés". */
  origem: Coordenadas | null;
  /** Filtros em vigor (a URL): o rascunho parte deles a cada abertura. */
  filters: CafeFilters;
  onAplicar: (next: CafeFilters) => void;
  children: (rascunho: CafeFilters, mudar: (next: CafeFilters) => void) => React.ReactNode;
};

/**
 * Bottom sheet de filtro do mobile, com rascunho: marcar opções não mexe na
 * URL, e "Ver N cafés" já conta o resultado do rascunho. Só o botão aplica
 * (uma entrada no histórico); Esc, toque no fundo ou arrasto para baixo descartam.
 */
export function RascunhoSheet({ titulo, trigger, cafes, festivais, origem, filters, onAplicar, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(filters);

  const abrirOuFechar = (abrir: boolean) => {
    if (abrir) setRascunho(filters);
    setAberto(abrir);
  };
  // A busca não é do sheet: um termo que chega com ele aberto (debounce do
  // campo) vale para a contagem e não é desfeito ao aplicar.
  const efetivo = { ...rascunho, q: filters.q };
  const total = filtrarCafes(cafes, efetivo, { festivais, origem }).length;

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
  /** `radio` nas linhas de escolha única (`RaioOpcoes`). */
  role?: "checkbox" | "radio";
  tabIndex?: number;
  optionRef?: (el: HTMLButtonElement | null) => void;
};

/** Linha de 48 px do design: marca ✓ terracota à direita e semibold quando marcada. */
export function SheetOption({ checked, onToggle, children, role = "checkbox", tabIndex, optionRef }: OptionProps) {
  return (
    <button
      ref={optionRef}
      type="button"
      role={role}
      aria-checked={checked}
      tabIndex={tabIndex}
      onClick={onToggle}
      className={`flex h-12 w-full items-center justify-between gap-3 border-b border-line px-1 text-left text-[15px] text-espresso outline-offset-[-2px] ${checked ? "font-semibold" : ""}`}
    >
      <span className="flex items-center gap-2.5">{children}</span>
      {checked && <CheckIcon size={18} strokeWidth={2.2} className="flex-none text-terracotta" />}
    </button>
  );
}

/**
 * Escolha única do raio, em linhas de 48 px (sheet de distância e seção do
 * sheet de filtros): "Até 1 km" · "Até 3 km" · "Até 7 km" · "Qualquer
 * distância". Como num radio nativo, as setas andam e marcam, e só a marcada
 * entra no Tab.
 */
export function RaioOpcoes({ raioKm, onEscolher }: { raioKm: RaioKm | null; onEscolher: (km: RaioKm | null) => void }) {
  const linhas = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = OPCOES_DE_RAIO.indexOf(raioKm);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const proximo = proximoPelaSeta(e, atual, OPCOES_DE_RAIO.length);
    if (proximo === null) return;
    onEscolher(OPCOES_DE_RAIO[proximo]);
    linhas.current[proximo]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Distância" onKeyDown={onKeyDown}>
      {OPCOES_DE_RAIO.map((km, i) => (
        <SheetOption
          key={raioLabel(km)}
          role="radio"
          checked={km === raioKm}
          tabIndex={km === raioKm ? 0 : -1}
          optionRef={(el) => {
            linhas.current[i] = el;
          }}
          onToggle={() => onEscolher(km)}
        >
          {raioLabel(km)}
        </SheetOption>
      ))}
    </div>
  );
}
