import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DadosCafeForm } from "@/components/admin/dados-cafe-form";
import { FotosCafe } from "@/components/admin/fotos-cafe";
import { StatusCafe, VerNoSite } from "@/components/admin/status-cafe";
import { StatusForm } from "@/components/admin/status-form";
import { ArrowLeftIcon, ChevronDownIcon } from "@/components/icons";
import { coordenadasDoLink, salvarDadosCafe } from "@/lib/admin/cafe-actions";
import { caminhoDoCafe } from "@/lib/cafe";
import { getCafeById, listFotosDoCafe } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

type Props = { params: { id: string }; searchParams: { novo?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const cafe = await getCafeById(params.id);
  return { title: cafe?.nome ?? "Café não encontrado" };
}

const TITULO_SECAO = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3";

export default async function AdminCafe({ params, searchParams }: Props) {
  await requireAdmin();
  const [cafe, fotos] = await Promise.all([getCafeById(params.id), listFotosDoCafe(params.id)]);
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

      {/* Vindo do cadastro (#53): o próximo passo é aqui. */}
      {searchParams.novo === "1" && !cafe.ativo && (
        <p role="status" className="mb-4 rounded-lg bg-seal-bg px-4 py-3 text-[14px] font-medium text-seal-fg">
          Café cadastrado. Ele está fora do ar: suba as fotos e coloque no ar na seção Status.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <section aria-labelledby="secao-fotos" className="rounded-xl border border-card-line bg-white px-5 py-4">
          <h2 id="secao-fotos" className={TITULO_SECAO}>
            Fotos
          </h2>
          <FotosCafe cafe={cafe} fotos={fotos} />
        </section>
        <section aria-labelledby="secao-status" className="rounded-xl border border-card-line bg-white px-5 py-4">
          <h2 id="secao-status" className={TITULO_SECAO}>
            Status
          </h2>
          <StatusForm cafeId={cafe.id} nome={cafe.nome} ativo={cafe.ativo} />
        </section>
        {/* Formulário longo: recolhido até ser pedido. `details` nativo — teclado e leitor de tela de graça. */}
        <details className="group rounded-xl border border-card-line bg-white px-5 py-4">
          {/* `summary` aceita só heading e conteúdo inline: grade em vez de um `div` em volta. */}
          <summary className="-mx-5 -my-4 grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
            <h2 className={TITULO_SECAO}>Dados</h2>
            <span className="col-start-1 mt-1.5 text-[14px] text-ink-2">Editar nome, endereço, comodidades, horário…</span>
            <ChevronDownIcon
              size={18}
              strokeWidth={2}
              className="col-start-2 row-span-2 row-start-1 text-ink-2 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="mt-6 text-[13.5px] text-ink-3">
            Endereço no site: <code className="text-ink-2">{caminhoDoCafe(cafe)}</code> — não muda, para não quebrar
            links já compartilhados.
          </p>
          <DadosCafeForm
            cafe={cafe}
            ativo={cafe.ativo}
            salvar={salvarDadosCafe.bind(null, cafe.id)}
            buscarCoordenadas={coordenadasDoLink}
          />
        </details>
      </div>
    </>
  );
}
