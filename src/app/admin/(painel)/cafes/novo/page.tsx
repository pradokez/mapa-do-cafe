import type { Metadata } from "next";
import Link from "next/link";

import { DadosCafeForm } from "@/components/admin/dados-cafe-form";
import { ArrowLeftIcon } from "@/components/icons";
import { cadastrarCafe, coordenadasDoLink } from "@/lib/admin/cafe-actions";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Novo café" };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function NovoCafe() {
  await requireAdmin();

  return (
    <>
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 hover:text-espresso"
      >
        <ArrowLeftIcon size={14} strokeWidth={2} />
        Todos os cafés
      </Link>

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
