import type { Metadata } from "next";

import { EdicaoForm } from "@/components/admin/edicao-form";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { cadastrarEdicao } from "@/lib/admin/festivais-actions";
import { listFestivaisCadastrados } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Nova edição" };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function NovaEdicao() {
  await requireAdmin();
  const festivais = await listFestivaisCadastrados();

  return (
    <>
      <VoltarAoPainel href="/admin/festivais" rotulo="Todos os festivais" />

      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-[1.1] text-espresso">Nova edição</h1>
        <p className="mt-1.5 text-[14.5px] text-ink-2">
          A edição nasce como rascunho. Depois de cadastrar, adicione os cafés e publique.
        </p>
      </header>

      <section aria-label="Dados da edição" className="rounded-xl border border-card-line bg-white px-5 py-4">
        <EdicaoForm festivais={festivais} cadastrar={cadastrarEdicao} />
      </section>
    </>
  );
}
