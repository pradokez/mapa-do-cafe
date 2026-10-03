import Link from "next/link";

import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { Distancia } from "@/components/distancia";
import { ChevronRightIcon, XIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { localLabel } from "@/lib/format";
import { PREVIEW_WIDTH } from "@/lib/map-preview-placement";

type Props = {
  cafe: Cafe;
  onClose: () => void;
  linkRef?: React.Ref<HTMLAnchorElement>;
  style?: React.CSSProperties;
};

/**
 * Cartão flutuante do pin selecionado. Não sabe nada do Mapbox: o
 * `<CafeMap />` decide onde ele fica e passa a posição por `style`. O cartão
 * inteiro leva ao detalhe; o X é irmão do link, não botão dentro dele.
 */
export function CafeMapPreview({ cafe, onClose, linkRef, style }: Props) {
  const [photo] = resolveCafePhotos(cafe);

  return (
    <div
      style={{ width: PREVIEW_WIDTH, ...style }}
      className="absolute z-20 rounded-[14px] bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]"
    >
      <Link ref={linkRef} href={`/cafes/${cafe.slug}`} className="group flex gap-3 rounded-[14px] p-2 pr-3">
        <CafePhotoFrame photo={photo} className="size-[72px] flex-none rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px] pr-5 pt-0.5">
          <span className="font-display text-base leading-[1.2] text-espresso">{cafe.nome}</span>
          <span className="text-[12.5px] text-ink-3">
            {localLabel(cafe)}
            <Distancia destino={cafe} />
          </span>
          <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-terracotta group-hover:text-terracotta-hover">
            Ver detalhes
            <ChevronRightIcon size={13} strokeWidth={2.2} />
          </span>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-hover-soft text-ink-2 transition-colors hover:bg-line-strong"
      >
        <XIcon size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}
