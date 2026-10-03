import Link from "next/link";

import { atributosDo } from "@/components/cafe-atributos";
import { FaixaPrecoSimbolos } from "@/components/faixa-preco";
import { CoffeeIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { faixaPrecoNome, localLabel } from "@/lib/format";

export function CafeCard({ cafe }: { cafe: Cafe }) {
  const [photo] = resolveCafePhotos(cafe);
  const atributos = atributosDo(cafe);

  return (
    <Link href={`/cafes/${cafe.slug}`} className="block rounded-2xl">
      <article className="flex flex-col gap-3 rounded-2xl border border-card-line bg-white px-2.5 pb-3.5 pt-2.5 shadow-[0_1px_2px_rgba(44,26,14,.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_14px_28px_-10px_rgba(44,26,14,.22),0_2px_4px_rgba(44,26,14,.05)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <div
          className="relative aspect-[16/10] overflow-hidden rounded-[11px]"
          style={photo.kind === "placeholder" ? { background: photo.background } : undefined}
        >
          {photo.kind === "url" && (
            // eslint-disable-next-line @next/next/no-img-element -- fotos do Storage chegam na Fase 2
            <img src={photo.src} alt="" className="absolute inset-0 size-full object-cover" />
          )}
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
        </div>

        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-baseline justify-between gap-2.5">
            <h2 className="text-pretty font-display text-[19px] leading-[1.2] text-espresso">
              {cafe.nome}
            </h2>
            <span className="flex-none text-[13px] font-semibold tracking-[.05em] text-espresso">
              <FaixaPrecoSimbolos faixa={cafe.faixa_preco} />
              <span className="sr-only">Faixa de preço: {faixaPrecoNome(cafe.faixa_preco)}</span>
            </span>
          </div>
          <span className="text-[13px] text-ink-3">{localLabel(cafe)}</span>
          <ul className="mt-1 flex min-h-4 items-center gap-3 text-ink-2">
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
