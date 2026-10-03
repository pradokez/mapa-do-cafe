import { CafeMap } from "@/components/cafe-map";
import { Distancia } from "@/components/distancia";
import { InstagramIcon, NavigationIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { googleMapsUrl, instagramUrl } from "@/lib/format";

const CTA =
  "flex h-[46px] items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold transition-colors";

/** Aside do detalhe: mini mapa, endereço (com a distância, se houver posição) e atalhos de saída. */
export function CafeDetailAside({ cafe, className = "" }: { cafe: Cafe; className?: string }) {
  const instagram = instagramUrl(cafe);

  return (
    <aside
      aria-label="Como chegar"
      className={`flex flex-col gap-4 rounded-[18px] border border-card-line bg-white p-3.5 shadow-[0_1px_2px_rgba(44,26,14,.06),0_12px_30px_-16px_rgba(44,26,14,.2)] ${className}`}
    >
      <CafeMap cafes={[cafe]} selectedId={cafe.id} variant="mini" className="h-[230px] rounded-[12px]" />
      <div className="flex flex-col gap-1 px-1">
        <span className="text-[14.5px] font-semibold text-espresso">{cafe.endereco}</span>
        <span className="text-[13px] text-ink-3">
          {cafe.bairro}, {cafe.cidade} – PE
          {/* Só as coordenadas: o café inteiro não precisa ir para o cliente. */}
          <Distancia destino={{ lat: cafe.lat, lng: cafe.lng }} sufixo=" de você" />
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
        {instagram && (
          <a
            href={instagram}
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
