import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DadosCafeForm } from "@/components/admin/dados-cafe-form";
import { FotosCafe } from "@/components/admin/fotos-cafe";
import { StatusCafe, VerNoSite } from "@/components/admin/status-cafe";
import { ArrowLeftIcon, ChevronDownIcon } from "@/components/icons";
import { coordenadasDoLink, salvarDadosCafe } from "@/lib/admin/cafe-actions";
import { caminhoDoCafe } from "@/lib/cafe";
import { getCafeById } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const cafe = await getCafeById(params.id);
  return { title: cafe?.nome ?? "Café não encontrado" };
}

const TITULO_SECAO = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3";

// Seção que a próxima issue preenche (#47 status).
const SECOES = [{ id: "status", titulo: "Status", texto: "Em breve: tirar o café do ar e colocar de volta." }];

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
        {/* Formulário longo: recolhido até ser pedido. `details` nativo — teclado e leitor de tela de graça. */}
        <details className="group rounded-xl border border-card-line bg-white px-5 py-4">
          <summary className="-mx-5 -my-4 flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <h2 className={TITULO_SECAO}>Dados</h2>
              <span className="mt-1.5 block text-[14px] text-ink-2">Editar nome, endereço, comodidades, horário…</span>
            </span>
            <ChevronDownIcon
              size={18}
              strokeWidth={2}
              className="shrink-0 text-ink-2 transition-transform group-open:rotate-180"
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
