import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FotosCafe } from "@/components/admin/fotos-cafe";
import { StatusCafe, VerNoSite } from "@/components/admin/status-cafe";
import { ArrowLeftIcon } from "@/components/icons";
import { getCafeById } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const cafe = await getCafeById(params.id);
  return { title: cafe?.nome ?? "Café não encontrado" };
}

// Seções que as próximas issues preenchem (#47 status, #48 dados).
const TITULO_SECAO = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3";

const SECOES = [
  { id: "status", titulo: "Status", texto: "Em breve: tirar o café do ar e colocar de volta." },
  { id: "dados", titulo: "Dados", texto: "Em breve: edição de todos os dados do café." },
];

export default async function AdminCafe({ params }: Props) {
  await requireAdmin();
  const cafe = await getCafeById(params.id);
  if (!cafe) notFound();

  return (
    <>
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 hover:text-espresso"
      >
        <ArrowLeftIcon size={14} strokeWidth={2} />
        Todos os cafés
      </Link>

      <header className="mb-8 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] text-espresso">{cafe.nome}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">
            {cafe.bairro} · {cafe.cidade}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusCafe ativo={cafe.ativo} />
          <VerNoSite slug={cafe.slug} ativo={cafe.ativo} />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="secao-fotos" className="rounded-xl border border-card-line bg-white px-5 py-4">
          <h2 id="secao-fotos" className={TITULO_SECAO}>
            Fotos
          </h2>
          <FotosCafe cafe={cafe} />
        </section>
        {SECOES.map((secao) => (
          <section
            key={secao.id}
            aria-labelledby={`secao-${secao.id}`}
            className="rounded-xl border border-card-line bg-white px-5 py-4"
          >
            <h2 id={`secao-${secao.id}`} className={TITULO_SECAO}>
              {secao.titulo}
            </h2>
            <p className="mt-1.5 text-[14px] text-ink-2">{secao.texto}</p>
          </section>
        ))}
      </div>
    </>
  );
}
