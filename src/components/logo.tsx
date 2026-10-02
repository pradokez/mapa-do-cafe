/**
 * Logo 2d, "etiqueta adesiva" (PRD › Identidade visual).
 * "Recife!" é parte do logo: fica sempre abaixo do título, nunca inline.
 */
export function Logo() {
  return (
    <span className="inline-flex flex-col items-end pt-1 font-logo leading-none">
      <span className="text-[27px] text-espresso">Mapa do Café</span>
      <span
        aria-hidden="true"
        className="-mr-2 -mt-[5px] -rotate-[5deg] rounded-full bg-terracotta px-[9px] pb-1 pt-0.5 text-[13px] text-on-terracotta shadow-[2px_2px_0_theme(colors.espresso)]"
      >
        Recife!
      </span>
    </span>
  );
}
