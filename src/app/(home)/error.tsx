"use client";

import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { HOME_COLUNAS } from "@/components/medidas";
import { PilulaDoMapa } from "@/components/pilula-do-mapa";
import { SiteHeader } from "@/components/site-header";

/**
 * Qualquer erro do servidor na home, inclusive o prazo das leituras (#138).
 * Só o logo no header — busca e filtros não funcionariam sem os cafés —, a
 * falha na coluna da lista e, no desktop, o mapa indisponível. Sem o FAB.
 */
export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <div className={HOME_COLUNAS}>
        <main className="overflow-y-auto">
          <FalhaAoCarregar
            corpo="Não conseguimos carregar os cafés agora. Confira sua conexão e tente de novo."
            reset={reset}
          />
        </main>
        {/* O alerta já diz que nada carregou. */}
        <div aria-hidden="true" className="relative hidden bg-map-bg lg:block">
          <PilulaDoMapa estado="indisponivel" />
        </div>
      </div>
    </div>
  );
}
