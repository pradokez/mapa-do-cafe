"use client";

import { useState } from "react";

import { CheckIcon } from "@/components/icons";

/**
 * "Avise-me quando abrir" (avaliações chegam na Fase 3). Sem backend: o
 * clique só confirma localmente, para o botão não parecer quebrado. Não
 * persiste nada e não chama a rede.
 */
export function NotifyButton() {
  const [anotado, setAnotado] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-disabled={anotado}
        onClick={() => setAnotado(true)}
        className={`mt-2 inline-flex h-[42px] items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors ${
          anotado
            ? "cursor-default border-open text-open"
            : "border-espresso text-espresso hover:bg-espresso hover:text-cream"
        }`}
      >
        {anotado ? (
          <>
            <CheckIcon strokeWidth={2.2} />
            Anotado! A gente te avisa quando abrir.
          </>
        ) : (
          "Avise-me quando abrir"
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {anotado && "Anotado! A gente te avisa quando abrir."}
      </span>
    </>
  );
}
