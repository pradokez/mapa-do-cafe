import Link from "next/link";

import { atributosDo } from "@/components/cafe-atributos";
import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { Distancia } from "@/components/distancia";
import { FaixaPrecoSimbolos } from "@/components/faixa-preco";
import { CoffeeIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
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

export function CafeCard({ cafe, highlight }: { cafe: Cafe; highlight?: CardHighlight }) {
  const [photo] = resolveCafePhotos(cafe);
  const atributos = atributosDo(cafe);

  return (
    <Link href={`/cafes/${cafe.slug}`} className="block h-full rounded-2xl">
      <article
        className={`flex h-full flex-col gap-3 rounded-2xl border bg-white px-2.5 pb-3.5 pt-2.5 shadow-[0_1px_2px_rgba(44,26,14,.06)] transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none ${highlight ? LIFTED : LIFT_ON_HOVER} ${highlight === "linked" ? "border-terracotta" : "border-card-line"}`}
      >
        <CafePhotoFrame photo={photo} className="aspect-[16/10] rounded-[11px]">
          {cafe.selo_ascape && (
            <span className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center gap-[5px] rounded-full bg-cream px-2.5 text-xs font-semibold text-espresso shadow-[0_1px_3px_rgba(44,26,14,.15)]">
              <CoffeeIcon size={13} strokeWidth={2.2} className="text-terracotta" />
              Recife Coffee
            </span>
          )}
          {photo.kind === "placeholder" && (
            <span
              aria-hidden="true"
              className="absolute bottom-[9px] left-[11px] text-[10.5px] uppercase tracking-[.08em] text-espresso/50"
            >
              foto · {cafe.nome}
            </span>
          )}
        </CafePhotoFrame>

        <div className="flex flex-1 flex-col gap-1.5 px-1">
          <div className="flex items-start justify-between gap-2.5">
            {/* Duas linhas reservadas mesmo com nome curto: bairro e ícones ficam na
                mesma altura em todos os cards. O corte é só visual; o nome inteiro
                continua no DOM para leitor de tela e aparece no hover. */}
            <h2
              title={cafe.nome}
              className="line-clamp-2 min-h-[2.4em] text-pretty font-display text-[19px] leading-[1.2] text-espresso"
            >
              {cafe.nome}
            </h2>
            <span className="flex-none pt-1 text-[13px] font-semibold tracking-[.05em] text-espresso">
              <FaixaPrecoSimbolos faixa={cafe.faixa_preco} />
              <span className="sr-only">Faixa de preço: {faixaPrecoNome(cafe.faixa_preco)}</span>
            </span>
          </div>
          <span className="text-[13px] text-ink-3">
            {localLabel(cafe)}
            <Distancia destino={cafe} />
          </span>
          <ul className="mt-auto flex min-h-4 pt-1 items-center gap-3 text-ink-2">
            {atributos.map(({ key, label, Icon }) => (
              <li key={key} title={label} className="inline-flex">
                <Icon />
                <span className="sr-only">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </Link>
  );
}
