import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { SugestaoForm } from "@/components/sugestao-form";
import { getCafeBySlug } from "@/lib/cafe-repository";
import { SITE_NOME } from "@/lib/cafe-seo";
import { origemSegura } from "@/lib/sugestao";

// Fora de busca (e fora do sitemap): não é conteúdo, é um canal.
export const metadata: Metadata = {
  title: `Sugestões · ${SITE_NOME}`,
  robots: { index: false, follow: true },
};

type Props = { searchParams: { de?: string | string[] } };

/**
 * A página de onde a pessoa veio (`?de=`, posto pelo link do rodapé) e o nome
 * dela para a nota de privacidade. Café que não existe (ou saiu do ar) não vira
 * origem: ninguém chega dele pelo site.
 */
async function origemDaVisita(de: string | string[] | undefined) {
  const origem = origemSegura(de);
  if (origem === "/") return { origem, nome: "a lista de cafés" };
  if (!origem) return null;
  const cafe = await getCafeBySlug(origem.slice("/cafes/".length));
  return cafe && { origem, nome: cafe.nome };
}

export default async function SugestoesPage({ searchParams }: Props) {
  const visita = await origemDaVisita(searchParams.de);

  return (
    <div className="flex min-h-screen flex-col">
      {/* O header do detalhe: a busca só existe na home, onde há lista para filtrar. */}
      <SiteHeader />
      <main className="flex flex-1 flex-col px-[18px] pb-8 pt-2 lg:items-center lg:px-7 lg:pb-14 lg:pt-10">
        <div className="flex w-full flex-1 flex-col gap-[18px] lg:max-w-[580px] lg:flex-none lg:gap-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink-2 hover:text-terracotta lg:min-h-0 lg:text-[13.5px]"
          >
            <ArrowLeftIcon size={16} strokeWidth={2} />
            Voltar ao mapa
          </Link>
          <SugestaoForm origem={visita?.origem ?? null} nomeDaOrigem={visita?.nome ?? null} />
        </div>
      </main>
    </div>
  );
}
