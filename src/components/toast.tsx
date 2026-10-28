"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Visibilidade de um toast que some sozinho: `mostrar` reinicia a contagem,
 * e o timer morre com o componente.
 */
export function useToast(duracaoMs = 4500) {
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const esconder = useCallback(() => {
    clearTimeout(timer.current);
    setVisivel(false);
  }, []);
  const mostrar = useCallback(() => {
    clearTimeout(timer.current);
    setVisivel(true);
    timer.current = setTimeout(() => setVisivel(false), duracaoMs);
  }, [duracaoMs]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { visivel, mostrar, esconder };
}

type Props = {
  visivel: boolean;
  /** Toque no toast. Ele não entra no Tab: some sozinho e levaria o foco junto. */
  onClick?: () => void;
  icone?: React.ReactNode;
  children: React.ReactNode;
  /** Posição: quem usa decide (rodapé da lista, acima do FAB, dentro do sheet). */
  className?: string;
};

/**
 * Toast (#164, o primeiro do site): superfície `espresso`, texto `cream`
 * (15,58:1). Neutro — não sabe do que avisa. A live region (`role="status"`)
 * fica sempre montada, para o leitor de tela anunciar o texto quando ele
 * entra; o toast não rouba o foco.
 */
export function Toast({ visivel, onClick, icone, children, className = "" }: Props) {
  return (
    <div role="status" className={className}>
      {visivel && (
        <div
          onClick={onClick}
          className={`flex items-center gap-3 rounded-[14px] bg-espresso py-[13px] pl-4 pr-[18px] text-[14px] font-medium leading-[1.4] text-cream shadow-[0_18px_36px_-12px_rgba(44,26,14,.55)] motion-safe:animate-toast ${onClick ? "cursor-pointer" : ""}`}
        >
          {icone}
          <span>{children}</span>
        </div>
      )}
    </div>
  );
}
