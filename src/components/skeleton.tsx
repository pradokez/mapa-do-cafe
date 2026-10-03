/**
 * Peças do skeleton de carregamento (#45). Blocos ficam fora da árvore de
 * acessibilidade; quem anuncia o carregamento é o `CarregandoStatus`.
 */

const TONS = {
  /** Sobre superfície branca (card, aside). */
  claro: "bg-hover-soft",
  /** Sobre o `cream` da página — o `hover-soft` sumiria nele. */
  creme: "bg-line",
  /** Área do mapa: o mesmo fundo de quando o Mapbox ainda não desenhou. */
  mapa: "bg-map-bg",
};

/** Bloco que pulsa (parado com `prefers-reduced-motion`). */
export function Bloco({ tom = "claro", className = "" }: { tom?: keyof typeof TONS; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-skeleton=""
      className={`block ${TONS[tom]} ${tom === "mapa" ? "" : "motion-safe:animate-pulse"} ${className}`}
    />
  );
}

/**
 * Barra de uma linha de texto: ocupa a altura da linha (`leading`) do texto
 * que vai substituir, com a barra mais baixa no meio, como uma linha escrita.
 */
export function Linha({ tom = "claro", className = "" }: { tom?: keyof typeof TONS; className?: string }) {
  return (
    <span aria-hidden="true" className="flex h-[1lh] items-center">
      <Bloco tom={tom} className={`h-[0.8em] rounded-full ${className}`} />
    </span>
  );
}

/** Anúncio do carregamento para leitor de tela. */
export function CarregandoStatus({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}
