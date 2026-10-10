import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EdicaoForm } from "@/components/admin/edicao-form";
import { ParticipantesEdicao } from "@/components/admin/participantes-edicao";
import { PublicacaoForm } from "@/components/admin/publicacao-form";
import { LinkNoSite } from "@/components/admin/status-cafe";
import { StatusEdicao } from "@/components/admin/status-edicao";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { ChevronDownIcon } from "@/components/icons";
import { salvarEdicao } from "@/lib/admin/festivais-actions";
import { getEdicaoById, listArtesDaEdicao, listTodosCafes } from "@/lib/cafe-repository";
import { formatarPreco, periodoDaEdicao, urlDaEdicao } from "@/lib/festival";
import { statusNoAdmin } from "@/lib/festival-dados";
import { hojeEmRecife } from "@/lib/foto-upload";
import { requireAdmin } from "@/lib/admin/require-admin";

type Props = { params: { id: string }; searchParams: { nova?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const edicao = await getEdicaoById(params.id);
  return { title: edicao ? `${edicao.festival.nome} ${edicao.ano}` : "Edição não encontrada" };
}

const TITULO_SECAO = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3";

export default async function AdminEdicao({ params, searchParams }: Props) {
  await requireAdmin();
  const [edicao, cafes, artes] = await Promise.all([
    getEdicaoById(params.id),
    listTodosCafes(),
    listArtesDaEdicao(params.id),
  ]);
  if (!edicao) notFound();

  const nome = `${edicao.festival.nome} ${edicao.ano}`;
  const periodo = periodoDaEdicao(edicao);
  const status = statusNoAdmin(edicao, new Date());

  return (
    <>
      <VoltarAoPainel href="/admin/festivais" rotulo="Todos os festivais" />

      <header className="mb-8 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] text-espresso">{nome}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">
            {periodo} · {edicao.preco === null ? "sem preço" : `combo a ${formatarPreco(edicao.preco)}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusEdicao {...status} />
          {/* Futura, a página ainda dá 404 no site; publicada e no ar ou encerrada, abre. */}
          {edicao.publicada && status.status !== "futura" && (
            <LinkNoSite href={urlDaEdicao(edicao)} />
          )}
        </div>
      </header>

      {searchParams.nova === "1" && !edicao.publicada && (
        <p role="status" className="mb-4 rounded-lg bg-seal-bg px-4 py-3 text-[14px] font-medium text-seal-fg">
          Edição cadastrada como rascunho. Adicione os cafés participantes e publique quando estiver pronta.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <section aria-labelledby="secao-publicacao" className="rounded-xl border border-card-line bg-white px-5 py-4">
          <h2 id="secao-publicacao" className={TITULO_SECAO}>
            Publicação
          </h2>
          <PublicacaoForm
            edicaoId={edicao.id}
            nome={nome}
            periodo={periodo}
            publicada={edicao.publicada}
            preco={edicao.preco}
          />
        </section>
        {/* Recolhido até ser pedido, como os Dados do café. */}
        <details className="group rounded-xl border border-card-line bg-white px-5 py-4">
          <summary className="-mx-5 -my-4 grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
            <h2 className={TITULO_SECAO}>Dados</h2>
            <span className="col-start-1 mt-1.5 text-[14px] text-ink-2">Editar datas, preço e descrição</span>
            <ChevronDownIcon
              size={18}
              strokeWidth={2}
              className="col-start-2 row-span-2 row-start-1 text-ink-2 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="mt-6 text-[13.5px] text-ink-3">
            Página no site: <code className="text-ink-2">{urlDaEdicao(edicao)}</code>. O festival não muda depois do
            cadastro.
          </p>
          <EdicaoForm edicao={edicao} salvar={salvarEdicao.bind(null, edicao.id)} />
        </details>
        <section aria-labelledby="secao-participantes" className="rounded-xl border border-card-line bg-white px-5 py-4">
          <h2 id="secao-participantes" className={TITULO_SECAO}>
            Participantes
          </h2>
          <ParticipantesEdicao
            edicaoId={edicao.id}
            participacoes={edicao.participacoes}
            cafes={cafes}
            artes={artes}
            hoje={hojeEmRecife(new Date())}
          />
        </section>
      </div>
    </>
  );
}
