import type { Metadata } from "next";

import { FiltroDeStatus, ListaEmEspera, TrocaDeFiltro } from "@/components/admin/filtro-de-status";
import { ListaDeRevisoes } from "@/components/admin/lista-de-revisoes";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { contarRevisoes, listRevisoes } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";
import { statusDoFiltro } from "@/lib/revisao";

export const metadata: Metadata = { title: "Revisões" };

type Props = { searchParams: { status?: string | string[] } };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function Revisoes({ searchParams }: Props) {
  await requireAdmin();
  const ativos = statusDoFiltro(searchParams.status);
  const [revisoes, contagem] = await Promise.all([listRevisoes(ativos), contarRevisoes()]);
  const total = ativos.reduce((soma, status) => soma + contagem[status], 0);

  return (
    <TrocaDeFiltro lista="revisoes">
      <VoltarAoPainel />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Revisões</h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] text-ink-3">
            O que a curadoria encontrou, por café. Nada vai ao ar sem você decidir.
          </p>
        </div>
        <FiltroDeStatus ativos={ativos} contagem={contagem} />
      </div>

      <ListaEmEspera>
        <ListaDeRevisoes revisoes={revisoes} agora={new Date()} total={total} />
      </ListaEmEspera>
    </TrocaDeFiltro>
  );
}
