import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { atributosDo } from "@/components/cafe-atributos";
import { CafeCarousel } from "@/components/cafe-carousel";
import { CafeDetailAside } from "@/components/cafe-detail-aside";
import { CafeHoursPanel } from "@/components/cafe-hours-panel";
import { FaixaPrecoSimbolos } from "@/components/faixa-preco";
import { ArrowLeftIcon, CoffeeIcon, MapPinIcon, StarIcon } from "@/components/icons";
import { NotifyButton } from "@/components/notify-button";
import { SiteHeader } from "@/components/site-header";
import { resumoHorario } from "@/lib/cafe-hours";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { getCafeBySlug } from "@/lib/cafe-repository";
import { faixaPrecoNome } from "@/lib/format";

// Dinâmico: "hoje" no horário precisa ser o dia da visita. Com ISR, a página
// gerada às 23h50 seria servida depois da meia-noite com o dia anterior.
export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

// Uma query por request, compartilhada entre a página e o metadata.
const getCafe = cache(getCafeBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cafe = await getCafe(params.slug);
  return { title: cafe ? `${cafe.nome} · Mapa do Café` : "Café não encontrado · Mapa do Café" };
}

// Slots do carrossel do hero (design); faltas viram placeholder.
const HERO_SLOTS = 4;

const TAG =
  "inline-flex h-[38px] items-center gap-2 rounded-full border border-line-strong bg-white px-[15px] text-sm text-espresso";

export default async function CafePage({ params }: Props) {
  const cafe = await getCafe(params.slug);
  if (!cafe) notFound();

  const horario = resumoHorario(cafe.horario_funcionamento, new Date());

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-[22px] sm:px-7 xl:px-0">
        <nav aria-label="Trilha" className="mb-[18px] flex items-center gap-3.5 text-[13.5px] text-ink-3">
          <Link href="/" className="inline-flex flex-none items-center gap-1.5 font-semibold text-espresso">
            <ArrowLeftIcon size={15} strokeWidth={2} />
            Voltar ao mapa
          </Link>
          <span aria-hidden="true" className="h-3.5 w-px flex-none bg-chip-line" />
          <span className="min-w-0 truncate">
            {cafe.cidade} · {cafe.bairro} · {cafe.nome}
          </span>
        </nav>

        <CafeCarousel photos={resolveCafePhotos(cafe, { minSlots: HERO_SLOTS })} nome={cafe.nome} />

        {/* Mobile: título → aside → corpo. Desktop: aside fixo na 2ª coluna. */}
        <div className="mt-8 grid items-start gap-y-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-16 lg:gap-y-0">
          <div className="flex flex-col lg:col-start-1">
            {cafe.selo_ascape && (
              <span className="mb-3.5 inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-seal-bg px-3 text-[12.5px] font-semibold text-seal-fg">
                <CoffeeIcon size={13} strokeWidth={2.2} />
                Selo Recife Coffee
              </span>
            )}
            <h1 className="text-balance font-display text-[36px] leading-[1.05] tracking-[-0.015em] text-espresso lg:text-[58px]">
              {cafe.nome}
            </h1>
            <p className="mt-3.5 flex items-start gap-2 text-[15px] text-ink-2">
              <MapPinIcon strokeWidth={2} className="mt-[3px] flex-none text-terracotta" />
              <span>
                <span className="font-semibold text-espresso">{cafe.bairro}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                {cafe.endereco}
              </span>
            </p>
          </div>

          <CafeDetailAside cafe={cafe} className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1" />

          <div className="flex flex-col lg:col-start-1">
            <hr className="mb-[30px] hidden border-line lg:block lg:mt-[30px]" />
            <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Comodidades</h2>
            <ul className="flex flex-wrap gap-2">
              {cafe.selo_ascape && (
                <li className={TAG}>
                  <CoffeeIcon strokeWidth={1.9} />
                  Recife Coffee
                </li>
              )}
              {atributosDo(cafe).map(({ key, label, Icon }) => (
                <li key={key} className={TAG}>
                  <Icon strokeWidth={1.9} />
                  {label}
                </li>
              ))}
              <li className={TAG}>
                <span className="font-bold tracking-[.05em]">
                  <FaixaPrecoSimbolos faixa={cafe.faixa_preco} />
                </span>
                <span className="sr-only">Faixa de preço:</span>
                {faixaPrecoNome(cafe.faixa_preco)}
              </li>
            </ul>

            <hr className="mb-2 mt-[30px] border-line" />
            <CafeHoursPanel resumo={horario} />
            <hr className="mb-[30px] mt-2 border-line" />

            <section aria-labelledby="avaliacoes">
              <div className="mb-4 flex items-center gap-2.5">
                <h2 id="avaliacoes" className="font-display text-[26px] text-espresso">
                  Avaliações
                </h2>
                <span className="inline-flex h-[22px] items-center rounded-full border border-line-strong px-[9px] text-[11.5px] font-semibold text-ink-3">
                  Em breve
                </span>
              </div>
              <div className="flex flex-col items-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-chip-line bg-white px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-seal-bg text-terracotta">
                  <StarIcon size={22} strokeWidth={1.9} />
                </span>
                <p className="text-[17px] font-semibold text-espresso">Ainda sem avaliações</p>
                <p className="max-w-[380px] text-pretty text-[14.5px] leading-[1.55] text-ink-2">
                  Logo você vai poder contar como foi seu café aqui — do espresso ao atendimento.
                </p>
                <NotifyButton />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
