import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atributosDo, selosDo } from "@/components/cafe-atributos";
import { CafeCarousel } from "@/components/cafe-carousel";
import { CafeDetailAside } from "@/components/cafe-detail-aside";
import { CafeHoursPanel } from "@/components/cafe-hours-panel";
import { ComboDoFestival } from "@/components/combo-do-festival";
import { FaixaPrecoSimbolos } from "@/components/faixa-preco";
import { InfoIcon, MapPinIcon, StarIcon } from "@/components/icons";
import {
  DETALHE_ASIDE_POSICAO,
  DETALHE_COLUNA,
  DETALHE_GRADE,
  DETALHE_MAIN,
  DETALHE_NOME,
  DETALHE_TAG,
  DETALHE_TRILHA,
} from "@/components/medidas";
import { RodapeSugestoes } from "@/components/rodape-sugestoes";
import { SiteHeader } from "@/components/site-header";
import { VoltarAoMapa } from "@/components/voltar-ao-mapa";
import { caminhoDoCafe } from "@/lib/cafe";
import { resumoHorario } from "@/lib/cafe-hours";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { listFestivais } from "@/lib/cafe-repository";
import {
  descricaoCafe,
  imagemCompartilhamento,
  jsonLdCafe,
  OPEN_GRAPH_BASE,
  tituloCafe,
} from "@/lib/cafe-seo";
import { combosDoCafe } from "@/lib/festival";
import { faixaPrecoNome } from "@/lib/format";
import { siteUrl } from "@/lib/site-url.mjs";

import { getCafe } from "./get-cafe";

// Dinâmico: "hoje" no horário precisa ser o dia da visita. Com ISR, a página
// gerada às 23h50 seria servida depois da meia-noite com o dia anterior.
export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cafe = await getCafe(params.slug);
  if (!cafe) notFound();
  const title = tituloCafe(cafe);
  const description = descricaoCafe(cafe);
  const imagem = imagemCompartilhamento(cafe);
  return {
    title,
    description,
    alternates: { canonical: caminhoDoCafe(cafe) },
    openGraph: { ...OPEN_GRAPH_BASE, title, description, url: caminhoDoCafe(cafe), images: [imagem] },
    twitter: { card: "summary_large_image", title, description, images: [imagem] },
  };
}

// Slots do carrossel do hero (design); faltas viram placeholder.
const HERO_SLOTS = 4;

export default async function CafePage({ params }: Props) {
  const [cafe, edicoes] = await Promise.all([getCafe(params.slug), listFestivais()]);
  if (!cafe) notFound(); // o layout já barrou; aqui só estreita o tipo

  const agora = new Date();
  const horario = resumoHorario(cafe.horario_funcionamento, agora);
  // "Ativa hoje" decidido aqui, fora do cache das edições (dia de Recife).
  const combos = combosDoCafe(edicoes, cafe.id, agora);
  const selos = selosDo(cafe);
  const jsonLd = jsonLdCafe(cafe, new URL(caminhoDoCafe(cafe), siteUrl()).href);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        // `<` escapado: um "</script>" vindo do banco não fecha a tag antes da hora.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main className={DETALHE_MAIN}>
        <nav aria-label="Trilha" className={DETALHE_TRILHA}>
          <VoltarAoMapa />
          <span aria-hidden="true" className="h-3.5 w-px flex-none bg-chip-line" />
          <span className="min-w-0 truncate">
            {cafe.cidade} · {cafe.bairro} · {cafe.nome}
          </span>
        </nav>

        <CafeCarousel photos={resolveCafePhotos(cafe, { minSlots: HERO_SLOTS })} nome={cafe.nome} />

        <div className={DETALHE_GRADE}>
          <div className={DETALHE_COLUNA}>
            {selos.length > 0 && (
              <ul className="mb-3.5 flex flex-wrap gap-2">
                {selos.map(({ key, label, Icon }) => (
                  <li
                    key={key}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-seal-bg px-3 text-[12.5px] font-semibold text-seal-fg"
                  >
                    <Icon size={13} strokeWidth={2.2} />
                    Selo {label}
                  </li>
                ))}
              </ul>
            )}
            <h1 className={`${DETALHE_NOME} text-balance font-display text-espresso`}>
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

          <CafeDetailAside cafe={cafe} className={DETALHE_ASIDE_POSICAO} />

          <div className={DETALHE_COLUNA}>
            <hr className="mb-[30px] hidden border-line lg:block lg:mt-[30px]" />
            <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Comodidades</h2>
            <ul className="flex flex-wrap gap-2">
              {[...selos, ...atributosDo(cafe)].map(({ key, label, Icon }) => (
                <li key={key} className={DETALHE_TAG}>
                  <Icon strokeWidth={1.9} />
                  {label}
                </li>
              ))}
              <li className={DETALHE_TAG}>
                <span className="font-bold tracking-[.05em]">
                  <FaixaPrecoSimbolos faixa={cafe.faixa_preco} />
                </span>
                <span className="sr-only">Faixa de preço:</span>
                {faixaPrecoNome(cafe.faixa_preco)}
              </li>
            </ul>

            {combos.map(({ edicao, participacao }) => (
              <ComboDoFestival key={edicao.id} cafe={cafe} edicao={edicao} participacao={participacao} />
            ))}

            <hr className="mb-2 mt-[30px] border-line" />
            <CafeHoursPanel resumo={horario} />
            <hr className="mt-2 border-line" />
            {/* Desvio consciente: o design não tem a nota. Sem fonte oficial, horário,
                preço e comodidades mudam sem aviso (PRD › Risco de dado). */}
            <p className="mb-[30px] mt-3.5 flex items-start gap-1.5 text-[12.5px] leading-[1.45] text-ink-3">
              <InfoIcon size={14} strokeWidth={2} className="mt-px flex-none text-ink-3/60" />
              Informações podem mudar. Na dúvida, confira com o café antes de ir.
            </p>

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
              </div>
            </section>
          </div>
        </div>

        <RodapeSugestoes frase="Viu algo estranho nesta página?" de={caminhoDoCafe(cafe)} />
      </main>
    </div>
  );
}
