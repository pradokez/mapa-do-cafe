/**
 * Dica (tooltip) dos ícones do card: balão espresso que aparece com o
 * `group/dica` em hover; quem usa dá a posição (`DICA_ACIMA` ou a própria).
 * Decorativa (`aria-hidden` em quem usa): o nome já está em `sr-only` ao lado
 * do ícone. Sem o `title` nativo, que demora a aparecer e não segue a paleta.
 */
export const DICA =
  "pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-espresso px-2 py-1 text-xs font-medium text-cream opacity-0 shadow-[0_4px_10px_-2px_rgba(44,26,14,.35)] transition-opacity duration-150 group-hover/dica:opacity-100 motion-reduce:transition-none";

export const DICA_ACIMA = "bottom-full left-1/2 mb-1.5 -translate-x-1/2";
