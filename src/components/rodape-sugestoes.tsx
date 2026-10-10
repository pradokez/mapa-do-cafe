import Link from "next/link";

import { MessageCircleIcon } from "@/components/icons";

/** Email de contato direto, para quem prefere escrever a usar o formulário. */
const EMAIL_DE_CONTATO = "contatomapadocafe@gmail.com";

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
 * alvo de 44 px, puxado para perto da frase (a sobra do alvo não vira vão entre
 * as duas). Embaixo, o email de contato (`mailto:`), numa linha própria.
 */
export function RodapeSugestoes({ frase, de }: Props) {
  return (
    <div className="mt-6 border-t border-line pt-[18px] text-center text-[13px] text-ink-3 lg:mt-8 lg:pt-5">
      <div className="flex flex-col items-center gap-0.5 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-1.5">
        <MessageCircleIcon size={15} strokeWidth={2} className="hidden lg:block" />
        <span>{frase}</span>
        <Link
          href={`/sugestoes?de=${encodeURIComponent(de)}`}
          className="-mt-2.5 inline-flex min-h-11 items-center font-medium text-espresso underline underline-offset-[3px] hover:text-terracotta lg:mt-0 lg:min-h-0"
        >
          Envie uma sugestão
        </Link>
      </div>
      <p className="lg:mt-2">
        Ou, se preferir entrar em contato, basta enviar um email para{" "}
        <a
          href={`mailto:${EMAIL_DE_CONTATO}`}
          className="font-medium text-espresso underline underline-offset-[3px] hover:text-terracotta"
        >
          {EMAIL_DE_CONTATO}
        </a>
        .
      </p>
    </div>
  );
}
