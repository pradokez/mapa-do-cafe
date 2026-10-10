import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FestivalFaixa } from "@/components/festival-faixa";
import { FestivalGrade } from "@/components/festival-grade";
import { InfoIcon } from "@/components/icons";
import { FESTIVAL_CONTEUDO } from "@/components/medidas";
import { SiteHeader } from "@/components/site-header";
import { descricaoEdicao, jsonLdEdicao, OG_ALTURA, OG_LARGURA, OPEN_GRAPH_BASE, tituloEdicao } from "@/lib/cafe-seo";
import { urlDaEdicao } from "@/lib/festival";
import { siteUrl } from "@/lib/site-url.mjs";

import { getEdicao } from "./get-edicao";

// Dinâmica, como o detalhe do café: status e contagem de dias são do dia da
// visita em Recife, e uma página em cache atravessaria a meia-noite.
export const dynamic = "force-dynamic";

type Props = { params: { festival: string; ano: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pagina = await getEdicao(params.festival, params.ano);
  if (!pagina) notFound();
  const { edicao, combos } = pagina;
  const title = tituloEdicao(edicao);
  const description = descricaoEdicao(edicao, combos.length);
  const url = urlDaEdicao(edicao);
  // O `openGraph` daqui substitui o do layout inteiro, inclusive a imagem do
  // `opengraph-image.tsx` da raiz: ela volta aqui, explícita.
  const imagem = { url: "/opengraph-image", width: OG_LARGURA, height: OG_ALTURA, type: "image/png" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OPEN_GRAPH_BASE, title, description, url, images: [imagem] },
    twitter: { card: "summary_large_image", title, description, images: [imagem] },
  };
}

export default async function FestivalPage({ params }: Props) {
  const pagina = await getEdicao(params.festival, params.ano);
  if (!pagina) notFound();
  const { edicao, estado, noAr, combos, agora } = pagina;
  const encerrada = estado === "encerrada";
  const jsonLd = jsonLdEdicao(edicao, new URL(urlDaEdicao(edicao), siteUrl()).href);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        // `<` escapado: um "</script>" vindo do banco não fecha a tag antes da hora.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main>
        <FestivalFaixa edicao={edicao} estado={estado} participantes={combos.length} agora={agora} />
        <div className={`${FESTIVAL_CONTEUDO} flex flex-col gap-3.5 pb-10 pt-4 lg:gap-[22px] lg:pb-16 lg:pt-7`}>
          {encerrada && (
            <div className="flex flex-col gap-1 rounded-xl bg-hover-soft px-3.5 py-3 text-[13px] leading-[1.45] text-ink-2 lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3.5 lg:text-sm">
              <InfoIcon strokeWidth={2} className="hidden flex-none lg:block" />
              <p>
                <strong className="font-semibold text-espresso">Esta edição terminou.</strong> Os combos ficam aqui
                como registro, mas não estão mais à venda.
              </p>
              {noAr && noAr.id !== edicao.id && (
                <Link
                  href={urlDaEdicao(noAr)}
                  className="flex-none self-start font-semibold text-terracotta hover:text-terracotta-hover lg:ml-auto lg:self-auto"
                >
                  Ver edição {noAr.ano}
                </Link>
              )}
            </div>
          )}
          {combos.length > 0 ? (
            <FestivalGrade combos={combos} festival={edicao.festival.nome} ano={edicao.ano} encerrada={encerrada} />
          ) : (
            <p className="py-10 text-center text-[15px] text-ink-2">Os combos desta edição ainda vão aparecer aqui.</p>
          )}
        </div>
      </main>
    </div>
  );
}
