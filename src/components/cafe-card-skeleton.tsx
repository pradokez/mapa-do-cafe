import { CARD_COMODIDADES, CARD_CORPO, CARD_FOTO, CARD_MOLDURA, CARD_NOME } from "@/components/medidas";
import { Bloco, Linha } from "@/components/skeleton";

/**
 * Card da lista enquanto os cafés não chegam: a moldura real do `CafeCard`
 * com blocos no lugar de foto, nome, preço, bairro e comodidades — as mesmas
 * medidas, para a troca não pular.
 */
export function CafeCardSkeleton() {
  return (
    <div aria-hidden="true" className={`${CARD_MOLDURA} border-card-line`}>
      <Bloco className={CARD_FOTO} />
      <div className={CARD_CORPO}>
        <div className="flex items-start justify-between gap-2 lg:gap-2.5">
          <div className={`${CARD_NOME} flex-1`}>
            <Linha className="w-4/5" />
          </div>
          <span className="flex-none pt-[3px] text-xs lg:pt-1 lg:text-[13px]">
            <Linha className="w-5" />
          </span>
        </div>
        <span className="text-[12.5px] lg:text-[13px]">
          <Linha className="w-24" />
        </span>
        <div className={CARD_COMODIDADES}>
          <span className="flex items-center gap-2.5 lg:gap-1.5">
            {/* Mobile: 4 ícones de 14 px; desktop: as 6 fichas de 28 px. */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Bloco key={i} className={`size-3.5 rounded-full lg:block lg:size-7 ${i < 4 ? "" : "hidden"}`} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
