"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { CheckIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Cafe } from "@/lib/cafe";
import { proximoPelaSeta } from "@/components/radio-setas";
import { OPCOES_DE_RAIO, raioLabel, type Coordenadas, type RaioKm } from "@/lib/cafe-distance";
import { filtrarCafes, type CafeFilters } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";

/** O que os sheets chamam ao aplicar: o estado inteiro e, do rascunho, o instante da abertura. */
export type AplicarFiltros = (next: CafeFilters, agora?: Date) => void;

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
  /** Aplica o rascunho com o instante em que o sheet abriu (o do "Aberto agora"). */
  onAplicar: AplicarFiltros;
  /** Toast dentro do sheet, acima do botão: fora dele, o modal o esconderia (e o tiraria da árvore acessível). */
  aviso?: React.ReactNode;
  children: (rascunho: CafeFilters, mudar: (next: CafeFilters) => void) => React.ReactNode;
};

/**
 * Bottom sheet de filtro do mobile, com rascunho: marcar opções não mexe na
 * URL, e "Ver N cafés" já conta o resultado do rascunho. Só o botão aplica
 * (uma entrada no histórico); Esc, toque no fundo ou arrasto para baixo descartam.
 * O "Aberto agora" conta com o instante da abertura, que vai junto ao aplicar:
 * o número do botão é o da lista que aparece.
 */
export function RascunhoSheet({ titulo, trigger, cafes, festivais, origem, filters, onAplicar, aviso, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(filters);
  const [agora, setAgora] = useState<Date>();

  const abrirOuFechar = (abrir: boolean) => {
    if (abrir) {
      setRascunho(filters);
      setAgora(new Date());
    }
    setAberto(abrir);
  };
  // A busca não é do sheet: um termo que chega com ele aberto (debounce do
  // campo) vale para a contagem e não é desfeito ao aplicar.
  const efetivo = { ...rascunho, q: filters.q };
  const total = filtrarCafes(cafes, efetivo, { festivais, origem, agora }).length;

  return (
    <Sheet open={aberto} onOpenChange={abrirOuFechar}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetTitle>{titulo}</SheetTitle>
        <div className="-mx-[18px] min-h-0 overflow-y-auto px-[18px]">{children(rascunho, setRascunho)}</div>
        {aviso}
        <button
          type="button"
          onClick={() => {
            onAplicar(efetivo, agora);
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
  /** Indisponível (`aria-disabled`, `ink-3`): continua focável e clicável. */
  apagado?: boolean;
  /** No lugar do ✓ (o spinner da nova tentativa). */
  marca?: React.ReactNode;
};

/** Linha de 48 px do design: marca ✓ terracota à direita e semibold quando marcada. */
export function SheetOption({
  checked,
  onToggle,
  children,
  role = "checkbox",
  tabIndex,
  optionRef,
  apagado = false,
  marca,
}: OptionProps) {
  return (
    <button
      ref={optionRef}
      type="button"
      role={role}
      aria-checked={checked}
      aria-disabled={apagado || undefined}
      tabIndex={tabIndex}
      onClick={onToggle}
      className={`flex h-12 w-full items-center justify-between gap-3 border-b border-line px-1 text-left text-[15px] outline-offset-[-2px] ${apagado ? "text-ink-3" : "text-espresso"} ${checked ? "font-semibold" : ""}`}
    >
      <span className="flex items-center gap-2.5">{children}</span>
      {marca ?? (checked && <CheckIcon size={18} strokeWidth={2.2} className="flex-none text-terracotta" />)}
    </button>
  );
}

/**
 * Escolha única do raio, em linhas de 48 px (sheet de distância e seção do
 * sheet de filtros): "Até 1 km" · "Até 3 km" · "Até 7 km" · "Qualquer
 * distância". Como num radio nativo, as setas andam e marcam, e só a marcada
 * entra no Tab. Sem posição (#164), as linhas ficam apagadas, as setas não
 * marcam e o toque tenta a localização de novo, com o spinner na linha tocada.
 */
export function RaioOpcoes({
  raioKm,
  onEscolher,
  semPosicao = false,
  onTentar,
}: {
  raioKm: RaioKm | null;
  onEscolher: (km: RaioKm | null) => void;
  semPosicao?: boolean;
  onTentar?: () => void;
}) {
  const linhas = useRef<(HTMLButtonElement | null)[]>([]);
  const [tocada, setTocada] = useState<number | null>(null);
  const { tentando } = useGeolocation();
  const atual = OPCOES_DE_RAIO.indexOf(raioKm);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (semPosicao) return;
    const proximo = proximoPelaSeta(e, atual, OPCOES_DE_RAIO.length);
    if (proximo === null) return;
    onEscolher(OPCOES_DE_RAIO[proximo]);
    linhas.current[proximo]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Distância" aria-disabled={semPosicao || undefined} onKeyDown={onKeyDown}>
      {OPCOES_DE_RAIO.map((km, i) => (
        <SheetOption
          key={raioLabel(km)}
          role="radio"
          checked={km === raioKm}
          tabIndex={km === raioKm ? 0 : -1}
          optionRef={(el) => {
            linhas.current[i] = el;
          }}
          apagado={semPosicao}
          marca={
            semPosicao && tentando && tocada === i ? (
              <Spinner className="size-4 border-line-strong border-t-ink-3" />
            ) : undefined
          }
          onToggle={() => {
            if (!semPosicao) return onEscolher(km);
            setTocada(i);
            onTentar?.();
          }}
        >
          {raioLabel(km)}
        </SheetOption>
      ))}
    </div>
  );
}
