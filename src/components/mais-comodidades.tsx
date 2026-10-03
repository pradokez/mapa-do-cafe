"use client";

import { useEffect, useRef, useState } from "react";

import { DICA, DICA_ACIMA } from "@/components/dica";

/**
 * "+N" do card mobile: as comodidades que não couberam. É o único alvo do
 * card além do link, porque precisa mostrar os nomes também no toque e no
 * foco de teclado — as fichas só têm dica no hover. O nome acessível já lista
 * as que ficaram de fora; o balão é só visual.
 */
export function MaisComodidades({ nomes }: { nomes: string[] }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // O Safari do iPhone não dá foco ao botão no toque: sem blur, fecha no toque fora.
  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    return () => document.removeEventListener("pointerdown", fecharFora);
  }, [aberto]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setAberto((a) => !a)}
      onBlur={() => setAberto(false)}
      onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
      className="group/dica relative z-10 -mx-1 inline-flex h-5 items-center rounded px-1 text-[11.5px] font-semibold text-ink-3 lg:hidden"
    >
      <span aria-hidden="true">+{nomes.length}</span>
      <span className="sr-only">
        e mais {nomes.length}: {nomes.join(", ")}
      </span>
      <span
        aria-hidden="true"
        className={`${DICA} ${DICA_ACIMA} group-focus-visible/dica:opacity-100 ${aberto ? "opacity-100" : ""}`}
      >
        {nomes.map((nome) => (
          <span key={nome} className="block text-left">
            {nome}
          </span>
        ))}
      </span>
    </button>
  );
}
