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
 * Barra de uma linha de texto: um espaço invisível dá à linha a altura exata
 * do texto que vai substituir (fonte e `leading` herdados), e a barra, mais
 * baixa, fica no meio, como uma linha escrita. `className` leva a largura
 * (no invólucro: em linha flexível, ele ocupa espaço e encolhe).
 */
export function Linha({ tom = "claro", className = "" }: { tom?: keyof typeof TONS; className?: string }) {
  return (
    <span aria-hidden="true" className={`relative block ${className}`}>
      {"\u00a0"}
      <Bloco tom={tom} className="absolute inset-x-0 top-1/2 h-[0.8em] -translate-y-1/2 rounded-full" />
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
