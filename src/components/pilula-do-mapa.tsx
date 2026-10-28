import { Spinner } from "@/components/spinner";

/**
 * Pílula no centro do mapa (PRD #135): "Carregando mapa…" com spinner, ou
 * "Mapa indisponível" sem ele. Neutra — não sabe de Mapbox —, para servir ao
 * skeleton e ao `CafeMap`. Quem usa dá o `relative` e decide a acessibilidade
 * (no skeleton, ela fica dentro de um `aria-hidden`). Não recebe clique: por
 * cima do mapa, o arrasto passa direto.
 */
export function PilulaDoMapa({ estado }: { estado: "carregando" | "indisponivel" }) {
  const carregando = estado === "carregando";
  return (
    <span
      className={`pointer-events-none absolute left-1/2 top-1/2 inline-flex h-[38px] -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap rounded-full border border-map-control-line bg-map-control px-4 text-[13px] text-map-control-fg ${
        carregando ? "gap-2.5 font-medium shadow-[0_12px_28px_-10px_rgba(0,0,0,.6)]" : "gap-2"
      }`}
    >
      {carregando && <Spinner className="size-3.5 border-map-control-line border-t-map-control-fg" />}
      {carregando ? "Carregando mapa…" : "Mapa indisponível"}
    </span>
  );
}
