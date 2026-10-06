"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { alternarStatus, milhar, STATUS_SUGESTAO, type ContagemDeSugestoes, type StatusSugestao } from "@/lib/sugestao";

const ROTULO_DO_CHIP: Record<StatusSugestao, string> = { nova: "Novas", lida: "Lidas", arquivada: "Arquivadas" };

type Troca = { pendente: boolean; pedido: StatusSugestao[] | null; filtrar: (status: StatusSugestao[]) => void };

const ContextoDaTroca = createContext<Troca | null>(null);

/**
 * Troca de filtro de `/admin/sugestoes` sem navegação de documento (#88): no
 * Next 14 o App Router não intercepta `<form method="get">`, e o envio puro
 * refazia a página inteira (header incluído) e voltava a rolagem ao topo.
 * Com JS, o filtro navega pelo router; a transição fica pendente até a página
 * nova chegar — enquanto isso, o chip pedido já aparece ligado e a lista atual
 * fica na tela, esmaecida (`ListaEmEspera`).
 */
export function TrocaDeFiltro({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [pedido, setPedido] = useState<StatusSugestao[] | null>(null);

  const filtrar = (status: StatusSugestao[]) => {
    setPedido(status);
    iniciar(() => router.push(`/admin/sugestoes?status=${status.join(",")}`, { scroll: false }));
  };

  // Fora da transição vale o filtro do servidor (inclusive se a navegação falhar).
  return (
    <ContextoDaTroca.Provider value={{ pendente, pedido: pendente ? pedido : null, filtrar }}>
      {children}
    </ContextoDaTroca.Provider>
  );
}

function useTroca(): Troca {
  const troca = useContext(ContextoDaTroca);
  if (!troca) throw new Error("FiltroDeStatus e ListaEmEspera precisam de <TrocaDeFiltro>.");
  return troca;
}

/** A lista atual enquanto a do filtro novo não chega: esmaecida e `aria-busy`. */
export function ListaEmEspera({ children }: { children: ReactNode }) {
  const { pendente } = useTroca();
  return (
    <div aria-busy={pendente || undefined} className={`transition-opacity ${pendente ? "opacity-60" : ""}`}>
      {children}
    </div>
  );
}

/**
 * Chips "Novas · Lidas · Arquivadas" de `/admin/sugestoes` (#84, design 3b).
 * Um `<form method="get">`: cada botão envia o filtro que resulta de clicá-lo
 * (`?status=nova,lida,arquivada`), e sem JS a página segue funcionando pelo
 * envio do form. Com JS, o envio vira navegação client-side (`TrocaDeFiltro`).
 * O último chip ligado não desliga: envia o filtro atual.
 */
export function FiltroDeStatus({ ativos, contagem }: { ativos: StatusSugestao[]; contagem: ContagemDeSugestoes }) {
  const { pedido, filtrar } = useTroca();
  const mostrados = pedido ?? ativos;

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    const chip = (e.nativeEvent as SubmitEvent).submitter;
    const status = STATUS_SUGESTAO.find((s) => s === chip?.dataset.status);
    if (!status) return;
    e.preventDefault();
    if (chip?.getAttribute("aria-disabled") !== "true") filtrar(alternarStatus(mostrados, status));
  };

  return (
    <form
      method="get"
      action="/admin/sugestoes"
      aria-label="Filtrar por status"
      onSubmit={aoEnviar}
      className="flex flex-wrap gap-1.5"
    >
      {STATUS_SUGESTAO.map((status) => {
        const ligado = mostrados.includes(status);
        const travado = ligado && mostrados.length === 1;
        return (
          <button
            key={status}
            type="submit"
            name="status"
            value={alternarStatus(mostrados, status).join(",")}
            data-status={status}
            aria-pressed={ligado}
            aria-disabled={travado || undefined}
            className={`inline-flex h-9 items-center gap-[7px] rounded-full border px-3.5 text-[13px] font-medium transition-colors aria-disabled:cursor-default ${
              ligado ? "border-espresso bg-espresso text-cream" : "border-line-strong bg-white text-espresso hover:bg-hover-soft"
            }`}
          >
            {ROTULO_DO_CHIP[status]}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold ${
                ligado ? "bg-cream/20 text-cream" : "bg-hover-soft text-ink-2"
              }`}
            >
              {milhar(contagem[status])}
            </span>
          </button>
        );
      })}
    </form>
  );
}
