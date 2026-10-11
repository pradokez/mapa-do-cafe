"use client";

import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { SiteHeader } from "@/components/site-header";

/**
 * Erro do servidor no detalhe, inclusive o prazo das leituras (#138). Mora no
 * segmento pai, e não em `[slug]/`: a existência do café é checada no
 * `layout.tsx` do slug (#72), e um `error.tsx` não pega erro do layout do
 * próprio segmento. O `notFound()` passa por ele: o 404 continua 404.
 */
export default function CafeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <FalhaAoCarregar
          corpo="Não conseguimos carregar este café agora. Confira sua conexão e tente de novo."
          reset={reset}
          voltarAoMapa
        />
      </main>
    </div>
  );
}
