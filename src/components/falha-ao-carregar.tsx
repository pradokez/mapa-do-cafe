"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { RotateCcwIcon } from "@/components/icons";
import { VoltarAoMapa } from "@/components/voltar-ao-mapa";
import { XicaraRachada } from "@/components/xicara-rachada";

type Props = {
  /** O que não carregou, por rota ("os cafés", "este café", "os combos"). */
  corpo: string;
  /** O `reset` do `error.tsx`. */
  reset: () => void;
  /** No detalhe e no festival; a home já é o mapa. */
  voltarAoMapa?: boolean;
};

/**
 * Falha ao carregar uma página pública (PRD #135): "O café não passou", no
 * vocabulário da "Xícara vazia". Anunciada (`role="alert"`) e com o foco no
 * título. "Tentar de novo" pede a página ao servidor de novo — no App Router,
 * o `reset` sozinho só re-renderiza o que já veio — e fica ocupado até ela
 * chegar.
 */
export function FalhaAoCarregar({ corpo, reset, voltarAoMapa = false }: Props) {
  const router = useRouter();
  const [tentando, startTransition] = useTransition();
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => titulo.current?.focus(), []);

  function tentarDeNovo() {
    if (tentando) return;
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-4 pb-10 pt-14 text-center lg:gap-3.5 lg:px-8 lg:pt-24"
    >
      {/* Página que falhou não entra no buscador. Com o `loading.tsx`, o
          shell já saiu com 200, e o Next só põe `noindex` sozinho no 404. */}
      <meta name="robots" content="noindex" />
      <XicaraRachada className="w-[110px] text-espresso lg:w-[132px]" />
      <h1 ref={titulo} tabIndex={-1} className="font-display text-[21px] text-espresso focus:outline-none lg:text-2xl">
        O café não passou
      </h1>
      <p className="max-w-[340px] text-pretty text-sm leading-normal text-ink-2 lg:text-[14.5px] lg:leading-[1.55]">
        {corpo}
      </p>
      <button
        type="button"
        onClick={tentarDeNovo}
        aria-disabled={tentando}
        aria-busy={tentando}
        className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-terracotta px-5 text-sm font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover aria-disabled:cursor-progress lg:h-[42px]"
      >
        <RotateCcwIcon size={15} strokeWidth={2.2} className={tentando ? "motion-safe:animate-[spin_0.8s_linear_infinite_reverse]" : ""} />
        Tentar de novo
      </button>
      {voltarAoMapa && <VoltarAoMapa className="mt-1 text-[14px] font-semibold text-espresso hover:text-terracotta" />}
    </div>
  );
}
