import Link from "next/link";

import { atributosDo, selosDo } from "@/components/cafe-atributos";
import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { DICA, DICA_ACIMA } from "@/components/dica";
import { Distancia } from "@/components/distancia";
import { FaixaPrecoSimbolos } from "@/components/faixa-preco";
import { MaisComodidades } from "@/components/mais-comodidades";
import { CARD_COMODIDADES, CARD_CORPO, CARD_FOTO, CARD_MOLDURA, CARD_NOME } from "@/components/medidas";
import { caminhoDoCafe, type Cafe } from "@/lib/cafe";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { faixaPrecoNome, localLabel } from "@/lib/format";

// Card elevado. A sombra difusa é terracota, a cor do pin ativo — desvio
// consciente do design, que usa espresso; a sombra curta de contato segue espresso.
const LIFTED =
  "-translate-y-[3px] shadow-[0_14px_28px_-10px_rgba(181,86,47,.35),0_2px_4px_rgba(44,26,14,.05)] motion-reduce:translate-y-0";
const LIFT_ON_HOVER =
  "hover:-translate-y-[3px] hover:shadow-[0_14px_28px_-10px_rgba(181,86,47,.35),0_2px_4px_rgba(44,26,14,.05)] motion-reduce:hover:translate-y-0";

/**
 * Destaque do card vindo de fora dele. `lifted`: elevado, como no hover do
 * próprio card (vale para foco de teclado). `linked`: elevado e com borda
 * terracota — o pin dele está em hover ou com o preview aberto no mapa.
 */
export type CardHighlight = "lifted" | "linked";

/** Comodidades que cabem na linha do card mobile; além disso, as primeiras e um "+N". */
const MAX_MOBILE = 5;

/**
 * Card da lista. Abaixo de `lg`, o compacto do mobile (thumb lateral 92×92,
 * selinhos de ícone no canto da thumb, comodidades em ícones soltos com corte
 * em "+N"); a partir de `lg`, foto 16/10 em cima com os selos em pílula e as
 * comodidades em fichas redondas, todas numa linha.
 *
 * O link é o nome, esticado sobre o card (`after:inset-0`): assim o "+N" pode
 * ser um botão próprio, fora do `<a>`. Fichas e selinhos ficam acima da camada
 * do link para mostrar a dica no hover.
 */
export function CafeCard({ cafe, highlight }: { cafe: Cafe; highlight?: CardHighlight }) {
  const [photo] = resolveCafePhotos(cafe);
  const selos = selosDo(cafe);
  const atributos = atributosDo(cafe);

  const corte = atributos.length > MAX_MOBILE ? MAX_MOBILE - 1 : atributos.length;
  const deFora = atributos.slice(corte).map(({ label }) => label);

  return (
    <article
      className={`${CARD_MOLDURA} transition-[transform,box-shadow,border-color] duration-200 focus-within:z-10 hover:z-10 motion-reduce:transition-none ${highlight ? LIFTED : LIFT_ON_HOVER} ${highlight === "linked" ? "border-terracotta" : "border-card-line"}`}
    >
      <CafePhotoFrame
        photo={photo}
        className={CARD_FOTO}
      >
        {selos.length > 0 && (
          <span className="absolute left-2.5 top-2.5 hidden flex-col items-start gap-1.5 lg:flex">
            {selos.map(({ key, label, Icon }) => (
              <span
                key={key}
                className="inline-flex h-[26px] items-center gap-[5px] rounded-full bg-cream px-2.5 text-xs font-semibold text-espresso shadow-[0_1px_3px_rgba(44,26,14,.15)]"
              >
                <Icon size={13} strokeWidth={2.2} className="text-terracotta" />
                {label}
              </span>
            ))}
          </span>
        )}
        {photo.kind === "placeholder" && (
          <span
            aria-hidden="true"
            className="absolute bottom-[9px] left-[11px] hidden text-[10.5px] uppercase tracking-[.08em] text-espresso/50 lg:block"
          >
            foto · {cafe.nome}
          </span>
        )}
      </CafePhotoFrame>
      {/* Selinhos do mobile: fora da moldura (que corta o que vaza) para a dica
          caber; a posição cai no canto da thumb, 6 px dentro. */}
      {selos.length > 0 && (
        <ul className="absolute left-3.5 top-3.5 flex gap-1 lg:hidden">
          {selos.map(({ key, label, Icon }) => (
            <li
              key={key}
              className="group/dica relative z-10 flex size-6 items-center justify-center rounded-full bg-cream shadow-[0_1px_3px_rgba(44,26,14,.18)]"
            >
              <Icon size={12} strokeWidth={2.4} className="text-terracotta" />
              <span className="sr-only">{label}</span>
              <span aria-hidden="true" className={`${DICA} left-0 top-full mt-1.5`}>
                {label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={CARD_CORPO}>
        <div className="flex items-start justify-between gap-2 lg:gap-2.5">
          {/* Duas linhas no máximo; no desktop, reservadas mesmo com nome curto:
              bairro e ícones ficam na mesma altura em todos os cards. O corte é
              só visual; o nome inteiro continua no DOM para leitor de tela e
              aparece no hover. */}
          <h2
            title={cafe.nome}
            className={`${CARD_NOME} line-clamp-2 text-pretty font-display text-espresso`}
          >
            <Link
              href={caminhoDoCafe(cafe)}
              className="after:absolute after:inset-0 after:rounded-[13px] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-terracotta lg:after:rounded-[15px]"
            >
              {cafe.nome}
            </Link>
          </h2>
          <span className="flex-none pt-[3px] text-xs font-semibold tracking-[.05em] text-espresso lg:pt-1 lg:text-[13px]">
            <FaixaPrecoSimbolos faixa={cafe.faixa_preco} />
            <span className="sr-only">Faixa de preço: {faixaPrecoNome(cafe.faixa_preco)}</span>
          </span>
        </div>
        <span className="text-[12.5px] text-ink-3 lg:text-[13px]">
          {localLabel(cafe)}
          <Distancia destino={cafe} />
        </span>
        {/* Altura fixa no desktop: todos os cards da grade ficam com a mesma altura. */}
        <div className={CARD_COMODIDADES}>
          <ul aria-label="Comodidades" className="flex items-center gap-2.5 text-ink-2 lg:gap-1.5">
            {atributos.map(({ key, label, Icon }, i) => (
              <li
                key={key}
                className={`group/dica relative z-10 items-center justify-center lg:inline-flex lg:size-7 lg:rounded-full lg:bg-hover-soft ${i < corte ? "inline-flex" : "hidden"}`}
              >
                <Icon size={14} strokeWidth={1.9} className="lg:size-[15px]" />
                <span className="sr-only">{label}</span>
                <span aria-hidden="true" className={`${DICA} ${DICA_ACIMA}`}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
          {deFora.length > 0 && <MaisComodidades nomes={deFora} />}
        </div>
      </div>
    </article>
  );
}
