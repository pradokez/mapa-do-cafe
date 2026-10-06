import Link from "next/link";

import { MessageCircleIcon } from "@/components/icons";

type Props = {
  /** Frase do contexto: fim da lista, estado vazio ou detalhe. */
  frase: string;
  /** Página onde o link está (`/` ou `/cafes/{slug}`), levada como `?de=`. */
  de: string;
};

/**
 * Link discreto para `/sugestoes` no fim da lista e do detalhe (#83). Nada de
 * botão flutuante (brigaria com o FAB e com os controles do mapa) nem de header.
 * Desktop: numa linha, com o balão. Mobile: frase e link em coluna, o link com
 * alvo de 44 px.
 */
export function RodapeSugestoes({ frase, de }: Props) {
  return (
    <div className="mt-6 flex flex-col items-center gap-0.5 border-t border-line pt-[18px] text-center text-[13px] text-ink-3 lg:mt-8 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-1.5 lg:pt-5">
      <MessageCircleIcon size={15} strokeWidth={2} className="hidden lg:block" />
      <span>{frase}</span>
      <Link
        href={`/sugestoes?de=${encodeURIComponent(de)}`}
        className="inline-flex min-h-11 items-center font-medium text-espresso underline underline-offset-[3px] hover:text-terracotta lg:min-h-0"
      >
        Envie uma sugestão
      </Link>
    </div>
  );
}
