import type { Cafe } from "@/lib/cafe";
import { resolveCafePhotos } from "@/lib/cafe-photos";
import { faixaPrecoNome, localLabel } from "@/lib/format";

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// Ícones (Lucide) dos três atributos do card, como no design.
const ATRIBUTOS = [
  {
    key: "aceita_pets",
    label: "Aceita pets",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="11" cy="4" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="20" cy="16" r="2" />
        <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
      </svg>
    ),
  },
  {
    key: "tem_estacionamento",
    label: "Tem estacionamento",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    key: "permite_coffee_office",
    label: "Permite coffee office",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
        <path d="M20.054 15.987H3.946" />
      </svg>
    ),
  },
] as const satisfies ReadonlyArray<{ key: keyof Cafe; label: string; icon: JSX.Element }>;

export function CafeCard({ cafe }: { cafe: Cafe }) {
  const [photo] = resolveCafePhotos(cafe);
  const atributos = ATRIBUTOS.filter(({ key }) => cafe[key]);

  return (
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
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-terracotta"
            >
              <path d="M10 2v2" />
              <path d="M14 2v2" />
              <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
              <path d="M6 2v2" />
            </svg>
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
          <h2 className="text-pretty font-display text-[19px] font-bold leading-[1.2] text-espresso">
            {cafe.nome}
          </h2>
          <span className="flex-none text-[13px] font-semibold tracking-[.05em] text-espresso">
            <span aria-hidden="true">
              {cafe.faixa_preco}
              <span className="text-price-off">{"$".repeat(3 - cafe.faixa_preco.length)}</span>
            </span>
            <span className="sr-only">Faixa de preço: {faixaPrecoNome(cafe.faixa_preco)}</span>
          </span>
        </div>
        <span className="text-[13px] text-ink-3">{localLabel(cafe)}</span>
        <ul className="mt-1 flex min-h-4 items-center gap-3 text-ink-2">
          {atributos.map(({ key, label, icon }) => (
            <li key={key} title={label} className="inline-flex">
              {icon}
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
