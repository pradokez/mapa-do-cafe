"use client";

// Client: acompanha lat/lng enquanto são digitados e só monta o mapa quando ele aparece na tela.
import { useEffect, useMemo, useRef, useState } from "react";

import { CafeMap } from "@/components/cafe-map";
import { ASIDE_MAPA } from "@/components/medidas";
import { dentroDaRegiao, lerNumero, type Coordenadas } from "@/lib/cafe-dados";

const PIN_ID = "posicao";

/** Posição que o pin pode mostrar: os dois números e dentro da `REGIAO`. */
function posicaoDe(textoLat: string, textoLng: string): Coordenadas | null {
  const lat = lerNumero(textoLat);
  const lng = lerNumero(textoLng);
  if (lat === null || lng === null || !dentroDaRegiao({ lat, lng })) return null;
  return { lat, lng };
}

/**
 * Mini mapa do formulário de dados (#53): o pin de `lat`/`lng`, para conferir a
 * posição antes de salvar. Usa o `<CafeMap />` (regra 1). Montado só quando
 * aparece: na edição, o formulário fica num `<details>` fechado, e cada mapa
 * criado conta na cota do Mapbox.
 */
export function MapaDePosicao({ lat, lng }: { lat: string; lng: string }) {
  const moldura = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = moldura.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      setVisivel(true);
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Digitando, a posição passa por valores incompletos: o pin fica na última válida.
  const atual = posicaoDe(lat, lng);
  const [ultima, setUltima] = useState(atual);
  if (atual && (atual.lat !== ultima?.lat || atual.lng !== ultima?.lng)) setUltima(atual);

  const pins = useMemo(() => (ultima ? [{ id: PIN_ID, nome: "Posição do café", ...ultima }] : []), [ultima]);

  return (
    <div>
      <div ref={moldura} className={`overflow-hidden bg-map-bg ${ASIDE_MAPA}`}>
        {ultima ? (
          visivel && <CafeMap cafes={pins} selectedId={PIN_ID} variant="mini" className="size-full" />
        ) : (
          <p className="flex size-full items-center justify-center px-6 text-center text-[13.5px] text-cream/70">
            O ponto aparece aqui quando latitude e longitude estiverem preenchidas.
          </p>
        )}
      </div>
      {ultima && (
        <p className="mt-1.5 text-[12.5px] text-ink-3" aria-live="polite">
          {atual
            ? "Confira se o pin está no lugar do café."
            : "Latitude ou longitude incompleta ou fora da região: o pin mostra a última posição válida."}
        </p>
      )}
    </div>
  );
}
