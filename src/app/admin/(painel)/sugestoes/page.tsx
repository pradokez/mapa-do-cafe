import type { Metadata } from "next";

import { FiltroDeStatus } from "@/components/admin/filtro-de-status";
import { ListaDeSugestoes } from "@/components/admin/lista-de-sugestoes";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { contarSugestoes, listSugestoes } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";
import { statusDoFiltro } from "@/lib/sugestao";

export const metadata: Metadata = { title: "Sugestões" };

type Props = { searchParams: { status?: string | string[] } };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function Sugestoes({ searchParams }: Props) {
  await requireAdmin();
  const ativos = statusDoFiltro(searchParams.status);
  const [sugestoes, contagem] = await Promise.all([listSugestoes(ativos), contarSugestoes()]);
  const total = ativos.reduce((soma, status) => soma + contagem[status], 0);

  return (
    <>
      <VoltarAoPainel />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Sugestões</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Mais recentes primeiro. Arquivadas ficam escondidas por padrão.</p>
        </div>
        <FiltroDeStatus ativos={ativos} contagem={contagem} />
      </div>

      <ListaDeSugestoes sugestoes={sugestoes} agora={new Date().toISOString()} total={total} />
    </>
  );
}
