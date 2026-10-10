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
 * Frase e link no mesmo parágrafo, que quebra como texto corrido; no desktop,
 * com o balão na frente. Embaixo, o email de contato (`mailto:`), no mesmo molde.
 */
export function RodapeSugestoes({ frase, de }: Props) {
  return (
    <div className="mt-6 border-t border-line pt-[18px] text-center text-[13px] text-ink-3 lg:mt-8 lg:pt-5">
      <p>
        <MessageCircleIcon
          size={15}
          strokeWidth={2}
          className="mr-1.5 hidden align-[-3px] lg:inline-block"
        />
        {frase}{" "}
        <Link
          href={`/sugestoes?de=${encodeURIComponent(de)}`}
          className="font-medium text-espresso underline underline-offset-[3px] hover:text-terracotta"
        >
          Envie uma sugestão
        </Link>
      </p>
      <p className="mt-2">
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
