import Link from "next/link";

import { ArteDoCombo } from "@/components/arte-do-combo";
import { ChevronRightIcon, InstagramIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import {
  ateODia,
  formatarPreco,
  tituloDoCombo,
  urlDaEdicao,
  type Edicao,
  type Participacao,
} from "@/lib/festival";

type Props = {
  cafe: Pick<Cafe, "id" | "fotos">;
  edicao: Edicao;
  participacao: Participacao;
};

const BOTAO = "inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold";

/**
 * Combo do café no festival em andamento (#103, design 4a/4c), depois das
 * comodidades. O site só acrescenta o que não está na arte: festival, prazo
 * e preço. Abaixo de `lg`, o arranjo do 4c (pílula em cima, arte, texto);
 * a partir dele, cartão com a arte à esquerda.
 */
export function ComboDoFestival({ cafe, edicao, participacao }: Props) {
  const festival = edicao.festival.nome;
  const titulo = tituloDoCombo(edicao, participacao);
  const ate = ateODia(edicao);
  const idTitulo = `combo-${edicao.id}`;
  const { arte, alt } = participacao;
  // Sem arte, o mesmo placeholder do café (o do card): nada para ampliar.
  const placeholder = resolveCafePhotos({ id: cafe.id, fotos: [] })[0];

  return (
    <section
      aria-labelledby={idTitulo}
      className="mt-[26px] grid gap-3 lg:mt-9 lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:rounded-[18px] lg:border lg:border-card-line lg:bg-white lg:p-4 lg:shadow-[0_1px_2px_rgba(44,26,14,.06)] xl:grid-cols-[300px_minmax(0,1fr)]"
    >
      <div className="flex items-center justify-between gap-2.5 lg:col-start-2 lg:row-start-1 lg:pt-2.5">
        <p className="inline-flex h-7 items-center gap-[7px] rounded-full bg-espresso px-3 text-[12.5px] font-semibold text-cream">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-festival-ponto" />
          <span>
            <span className="lg:hidden">Combo do </span>
            {festival}
            <span className="hidden lg:inline"> · {ate}</span>
          </span>
        </p>
        <span className="text-[12.5px] text-ink-3 lg:hidden">{ate}</span>
      </div>

      <figure className="flex flex-col gap-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        {arte && alt ? (
          <ArteDoCombo arte={arte} alt={alt} titulo={`${titulo} · ${festival}`} credito={`Arte: ${festival}`} />
        ) : (
          <div
            aria-hidden="true"
            data-testid="arte-placeholder"
            className="aspect-[4/5] w-full rounded-[14px] lg:rounded-xl"
            style={{ background: placeholder.kind === "placeholder" ? placeholder.background : undefined }}
          />
        )}
        <figcaption className="px-0.5 text-xs text-ink-3">Arte: {festival}</figcaption>
      </figure>

      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2 lg:pb-2.5 lg:pr-3">
        {/* No mobile, título e nome numa linha ("Combo 13 · Profiteroles"); no desktop, empilhados. */}
        <div className="text-[15px] font-semibold text-espresso lg:flex lg:flex-col lg:gap-3 lg:font-normal">
          <h2 id={idTitulo} className="inline lg:block lg:font-display lg:text-[30px] lg:leading-[1.1]">
            {titulo}
          </h2>
          {participacao.nome_combo && (
            <p className="inline lg:block lg:text-base lg:leading-normal lg:text-ink-2">
              <span aria-hidden="true" className="lg:hidden"> · </span>
              {participacao.nome_combo}
            </p>
          )}
        </div>
        {edicao.preco !== null && (
          <p className="flex flex-wrap items-baseline gap-x-2 lg:mt-1">
            <span className="text-[17px] font-bold tabular-nums text-espresso lg:text-[26px]">
              {formatarPreco(edicao.preco)}
            </span>
            <span className="text-[13px] text-ink-3 lg:text-[13.5px]">preço único dos combos no festival</span>
          </p>
        )}
        <hr className="hidden border-line lg:my-1.5 lg:block" />
        <p className="text-pretty text-[13px] leading-[1.55] text-ink-3 lg:text-[13.5px]">
          Disponível enquanto durar o festival, no horário normal da casa.
        </p>
        <div className="mt-1 flex gap-2 lg:mt-auto lg:gap-2.5">
          {participacao.instagram_url && (
            <a
              href={participacao.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BOTAO} flex-1 border border-line-strong bg-white px-5 text-espresso hover:bg-hover-soft lg:flex-none`}
            >
              <InstagramIcon size={16} strokeWidth={2} />
              Ver no Instagram
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
          <Link
            href={urlDaEdicao(edicao)}
            aria-label="Outros combos do festival"
            className={`${BOTAO} flex-1 gap-1 px-1.5 text-terracotta hover:text-terracotta-hover lg:flex-none`}
          >
            <span>
              Outros combos<span className="hidden lg:inline"> do festival</span>
            </span>
            <ChevronRightIcon size={15} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
