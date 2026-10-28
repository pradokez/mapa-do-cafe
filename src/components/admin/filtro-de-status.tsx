"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  alternarStatus as alternarStatusDeRevisao,
  ROTULO_STATUS_REVISAO,
  STATUS_REVISAO,
  statusDoFiltro as statusDoFiltroDeRevisao,
} from "@/lib/revisao";
import {
  alternarStatus as alternarStatusDeSugestao,
  milhar,
  STATUS_SUGESTAO,
  statusDoFiltro as statusDoFiltroDeSugestao,
} from "@/lib/sugestao";

type Status = string;

/**
 * Uma configuração por lista: o filtro é client, e função não atravessa do
 * Server Component para cá — a página escolhe pelo nome.
 */
const LISTAS = {
  sugestoes: {
    rota: "/admin/sugestoes",
    todos: STATUS_SUGESTAO as readonly Status[],
    rotulos: { nova: "Novas", lida: "Lidas", arquivada: "Arquivadas" } as Record<Status, string>,
    doParam: statusDoFiltroDeSugestao as (param: string) => Status[],
    alternar: alternarStatusDeSugestao as (atuais: readonly Status[], status: Status) => Status[],
  },
  revisoes: {
    rota: "/admin/revisoes",
    todos: STATUS_REVISAO as readonly Status[],
    rotulos: ROTULO_STATUS_REVISAO as Record<Status, string>,
    doParam: statusDoFiltroDeRevisao as (param: string) => Status[],
    alternar: alternarStatusDeRevisao as (atuais: readonly Status[], status: Status) => Status[],
  },
};

export type NomeDaLista = keyof typeof LISTAS;

type Troca = {
  lista: NomeDaLista;
  pendente: boolean;
  pedido: Status[] | null;
  filtrar: (status: Status[]) => void;
};

const ContextoDaTroca = createContext<Troca | null>(null);

/**
 * Troca de filtro de `/admin/sugestoes` e `/admin/revisoes` sem navegação de documento (#88): no
 * Next 14 o App Router não intercepta `<form method="get">`, e o envio puro
 * refazia a página inteira (header incluído) e voltava a rolagem ao topo.
 * Com JS, o filtro navega pelo router; a transição fica pendente até a página
 * nova chegar — enquanto isso, o chip pedido já aparece ligado e a lista atual
 * fica na tela, esmaecida (`ListaEmEspera`).
 */
export function TrocaDeFiltro({ lista, children }: { lista: NomeDaLista; children: ReactNode }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [pedido, setPedido] = useState<Status[] | null>(null);

  const filtrar = (status: Status[]) => {
    setPedido(status);
    iniciar(() => router.push(`${LISTAS[lista].rota}?status=${status.join(",")}`, { scroll: false }));
  };

  // Fora da transição vale o filtro do servidor (inclusive se a navegação falhar).
  return (
    <ContextoDaTroca.Provider value={{ lista, pendente, pedido: pendente ? pedido : null, filtrar }}>
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
export function FiltroDeStatus({ ativos, contagem }: { ativos: Status[]; contagem: Record<Status, number> }) {
  const { lista, pedido, filtrar } = useTroca();
  const { rota, todos, rotulos, doParam, alternar } = LISTAS[lista];
  const mostrados = pedido ?? ativos;

  // O chip já leva no `value` o filtro que aplica — o mesmo que o GET enviaria.
  // O travado leva o filtro atual: não há para onde navegar.
  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    const chip = (e.nativeEvent as SubmitEvent).submitter;
    if (!(chip instanceof HTMLButtonElement)) return;
    e.preventDefault();
    const destino = doParam(chip.value);
    if (destino.join(",") !== mostrados.join(",")) filtrar(destino);
  };

  return (
    <form
      method="get"
      action={rota}
      aria-label="Filtrar por status"
      onSubmit={aoEnviar}
      className="flex flex-wrap gap-1.5"
    >
      {todos.map((status) => {
        const ligado = mostrados.includes(status);
        const travado = ligado && mostrados.length === 1;
        return (
          <button
            key={status}
            type="submit"
            name="status"
            value={alternar(mostrados, status).join(",")}
            aria-pressed={ligado}
            aria-disabled={travado || undefined}
            className={`inline-flex h-9 items-center gap-[7px] rounded-full border px-3.5 text-[13px] font-medium transition-colors aria-disabled:cursor-default ${
              ligado ? "border-espresso bg-espresso text-cream" : "border-line-strong bg-white text-espresso hover:bg-hover-soft"
            }`}
          >
            {rotulos[status]}
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
