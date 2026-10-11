"use client";

import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { SiteHeader } from "@/components/site-header";

/**
 * Erro do servidor na página do festival, inclusive o prazo das leituras
 * (#138). No segmento pai, como o do detalhe: pega também um layout que a
 * edição venha a ter. O `notFound()` passa por ele: o 404 continua 404.
 */
export default function FestivalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <FalhaAoCarregar
          corpo="Não conseguimos carregar os combos agora. Confira sua conexão e tente de novo."
          reset={reset}
          voltarAoMapa
        />
      </main>
    </div>
  );
}
