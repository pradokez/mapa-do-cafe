import { PilulaDoMapa } from "@/components/pilula-do-mapa";

/**
 * Peças do skeleton de carregamento (#45). Blocos ficam fora da árvore de
 * acessibilidade; quem anuncia o carregamento é o `CarregandoStatus`.
 */

// Com `prefers-reduced-motion`, o bloco fica na cor base lisa: o gradiente
// parado deixaria uma faixa de realce congelada num canto.
const BRILHO = "motion-safe:bg-gradient-to-r motion-safe:from-30% motion-safe:via-50% motion-safe:to-70% motion-safe:bg-[length:200%_100%] motion-safe:animate-brilho";

/** Cor base de cada tom: o bloco parado é só ela. */
const BASE = { claro: "bg-card-line", creme: "bg-line-strong" };

const TONS = {
  /** Sobre superfície branca (card, aside). */
  claro: `${BASE.claro} motion-safe:from-card-line motion-safe:via-brilho motion-safe:to-card-line ${BRILHO}`,
  /** Sobre o `cream` da página. */
  creme: `${BASE.creme} motion-safe:from-line-strong motion-safe:via-line motion-safe:to-line-strong ${BRILHO}`,
};

/**
 * Bloco com o brilho que corre (parado com `prefers-reduced-motion`).
 * `parado`: só a cor base, sem brilho — a foto que não carregou (#140).
 */
export function Bloco({
  tom = "claro",
  parado = false,
  className = "",
}: {
  tom?: keyof typeof TONS;
  parado?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-skeleton={parado ? "parado" : ""}
      className={`block ${parado ? BASE[tom] : TONS[tom]} ${className}`}
    />
  );
}

/** Área do mapa: o fundo de quando o Mapbox ainda não desenhou, com a pílula "Carregando mapa…". Não brilha. */
export function BlocoDoMapa({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" data-skeleton="" className={`relative block bg-map-bg ${className}`}>
      <PilulaDoMapa estado="carregando" />
    </span>
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
