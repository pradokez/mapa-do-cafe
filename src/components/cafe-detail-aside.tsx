import { InstagramIcon, NavigationIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { googleMapsUrl } from "@/lib/format";

const CTA =
  "flex h-[46px] items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold transition-colors";

/** Aside do detalhe: endereço e atalhos de saída. O mini mapa entra na #6; a distância, na #12. */
export function CafeDetailAside({ cafe, className = "" }: { cafe: Cafe; className?: string }) {
  return (
    <aside
      aria-label="Como chegar"
      className={`flex flex-col gap-4 rounded-[18px] border border-card-line bg-white p-3.5 shadow-[0_1px_2px_rgba(44,26,14,.06),0_12px_30px_-16px_rgba(44,26,14,.2)] ${className}`}
    >
      <div className="flex flex-col gap-1 px-1 pt-1">
        <span className="text-[14.5px] font-semibold text-espresso">{cafe.endereco}</span>
        <span className="text-[13px] text-ink-3">
          {cafe.bairro}, {cafe.cidade} – PE
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <a
          href={googleMapsUrl(cafe)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CTA} bg-terracotta text-on-terracotta hover:bg-terracotta-hover`}
        >
          <NavigationIcon strokeWidth={2} />
          Como chegar
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {cafe.instagram && (
          <a
            href={cafe.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CTA} border border-line-strong bg-white text-espresso hover:bg-hover-soft`}
          >
            <InstagramIcon strokeWidth={2} />
            Ver no Instagram
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
      </div>
    </aside>
  );
}
