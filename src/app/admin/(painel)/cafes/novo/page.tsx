import type { Metadata } from "next";

import { DadosCafeForm } from "@/components/admin/dados-cafe-form";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { cadastrarCafe, coordenadasDoLink } from "@/lib/admin/cafe-actions";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Novo café" };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function NovoCafe() {
  await requireAdmin();

  return (
    <>
      <VoltarAoPainel />

      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-[1.1] text-espresso">Novo café</h1>
        <p className="mt-1.5 text-[14.5px] text-ink-2">
          O café nasce fora do ar. Depois de cadastrar, suba as fotos e coloque no ar na seção Status.
        </p>
      </header>

      <section aria-label="Dados do café" className="rounded-xl border border-card-line bg-white px-5 py-4">
        <DadosCafeForm cadastrar={cadastrarCafe} buscarCoordenadas={coordenadasDoLink} />
      </section>
    </>
  );
}
