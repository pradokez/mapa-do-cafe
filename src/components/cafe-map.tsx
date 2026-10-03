"use client";

// Única fronteira com o Mapbox (regra 1 do CLAUDE.md): nenhum outro arquivo
// importa `mapbox-gl`. Quem usa o mapa fala só a língua desta interface.
import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { CafeMapPreview } from "@/components/cafe-map-preview";
import type { Cafe } from "@/lib/cafe";
import { placePreview } from "@/lib/map-preview-placement";

type Props = {
  cafes: Cafe[];
  /** `full`: mapa navegável da home. `mini`: localizador estático do detalhe. */
  variant?: "full" | "mini";
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Fecha o preview do café selecionado (X, Esc ou clique no mapa vazio). */
  onClose?: () => void;
  /** `pin`: preview flutuando junto ao pin (desktop). `bottom`: card preso embaixo (mobile). */
  previewPlacement?: "pin" | "bottom";
  className?: string;
};

type PreviewAnchor = { pin: { x: number; y: number }; size: { width: number; height: number } };

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Sem cafés para enquadrar: centro de Recife.
const RECIFE: [number, number] = [-34.9, -8.06];
const MINI_ZOOM = 15;
// Pins ancorados pela ponta sobem 40 px a partir do ponto; o zoom ocupa a direita.
const FIT_PADDING = { top: 72, right: 72, bottom: 32, left: 32 };

// dark-v11 recolorido para os tons do mapa ilustrativo do design. Camada que
// sumir do estilo é ignorada: o mapa fica mais frio, mas não quebra.
const PAINT: [layer: string, prop: string, value: string][] = [
  ["land", "background-color", "#1E1B19"],
  ["landuse", "fill-color", "#1E1B19"],
  ["national-park", "fill-color", "#1F2721"],
  ["land-structure-polygon", "fill-color", "#1E1B19"],
  ["building", "fill-color", "#191715"],
  ["water", "fill-color", "#15202A"],
  ["waterway", "line-color", "#18252F"],
  ["road-simple", "line-color", "#3E3833"],
  ["bridge-simple", "line-color", "#3E3833"],
  ["tunnel-simple", "line-color", "#36312D"],
  ["road-path", "line-color", "#2A2623"],
  ["road-pedestrian", "line-color", "#2A2623"],
  ["road-steps", "line-color", "#2A2623"],
  ["road-label-simple", "text-color", "#6F665E"],
  ["road-label-simple", "text-halo-color", "#1E1B19"],
  ["settlement-subdivision-label", "text-color", "#8C8279"],
  ["settlement-subdivision-label", "text-halo-color", "#1E1B19"],
  ["water-line-label", "text-color", "#4E6170"],
  ["water-point-label", "text-color", "#4E6170"],
  ["waterway-label", "text-color", "#4E6170"],
];

// Pin 32×40 do design. O Mapbox controla o `transform` do elemento externo,
// então escala e cores vivem no filho, guiadas por `data-active` no externo.
const PIN_SVG = `<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
<path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.6 16 39 16 39s15-12.4 15-23.2C31 7.6 24.3 1 16 1z" stroke-width="1.5" class="fill-map-pin stroke-espresso transition-colors group-data-[active=true]:fill-terracotta group-data-[active=true]:stroke-on-terracotta"/>
<g transform="translate(8.6 8.2) scale(0.62)" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="stroke-espresso transition-colors group-data-[active=true]:stroke-on-terracotta">
<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>
</g></svg>`;

const PIN_SCALE = {
  full: "group-data-[active=true]:scale-[1.3]",
  mini: "group-data-[active=true]:scale-[1.2]",
};

const LABEL = { full: "Mapa dos cafés", mini: "Mapa com a localização do café" };

const ZOOM_BUTTON =
  "flex size-[38px] items-center justify-center text-lg leading-none text-map-control-fg transition-colors hover:bg-map-control-hover focus-visible:-outline-offset-2";

/**
 * Mapa Mapbox com um pin por café. Só roda no cliente: a lib é carregada no
 * `useEffect`, então o servidor renderiza apenas o fundo. Sem token ou sem
 * WebGL, o fundo `map-bg` é tudo que aparece — a página segue funcionando.
 */
export function CafeMap({
  cafes,
  variant = "full",
  hoveredId = null,
  selectedId = null,
  onHover,
  onSelect,
  onClose,
  previewPlacement = "pin",
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapboxMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const mapboxRef = useRef<typeof import("mapbox-gl").default | null>(null);

  // Callbacks mais recentes sem recriar os pins a cada render do pai.
  const handlers = useRef({ onHover, onSelect, onClose });
  handlers.current = { onHover, onSelect, onClose };

  // Enquadramento só na criação: filtrar não deve fazer o mapa pular.
  const initialCafes = useRef(cafes);

  useEffect(() => {
    const container = containerRef.current;
    if (!TOKEN || !container) return;
    let cancelled = false;
    let instance: MapboxMap | undefined;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return;
      mapboxRef.current = mapboxgl;
      const cafes = initialCafes.current;
      const isMini = variant === "mini";

      let bounds: [[number, number], [number, number]] | undefined;
      if (!isMini && cafes.length > 0) {
        const lngs = cafes.map((c) => c.lng);
        const lats = cafes.map((c) => c.lat);
        bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];
      }

      try {
        instance = new mapboxgl.Map({
          container,
          accessToken: TOKEN,
          style: "mapbox://styles/mapbox/dark-v11",
          language: "pt",
          interactive: !isMini,
          attributionControl: false,
          // O canvas já é a `region` acessível do mapa; os textos da UI do Mapbox vêm em inglês.
          locale: {
            "Map.Title": LABEL[variant],
            "AttributionControl.ToggleAttribution": "Mostrar atribuição",
            "LogoControl.Title": "Site do Mapbox",
          },
          ...(bounds
            ? { bounds, fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 15 } }
            : { center: cafes[0] ? [cafes[0].lng, cafes[0].lat] : RECIFE, zoom: isMini ? MINI_ZOOM : 12 }),
        });
      } catch {
        // WebGL indisponível: fica o fundo.
        return;
      }

      instance.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
      instance.on("style.load", () => {
        if (!instance) return;
        for (const [layer, prop, value] of PAINT) {
          if (instance.getLayer(layer)) instance.setPaintProperty(layer, prop as never, value as never);
        }
        if (instance.getLayer("settlement-subdivision-label")) {
          instance.setLayoutProperty("settlement-subdivision-label", "text-transform", "uppercase");
          instance.setLayoutProperty("settlement-subdivision-label", "text-letter-spacing", 0.16);
        }
        // POIs do estilo competem com os pins dos cafés.
        if (instance.getLayer("poi-label")) instance.setLayoutProperty("poi-label", "visibility", "none");
      });
      setMap(instance);
    });

    const current = markers.current;
    return () => {
      cancelled = true;
      current.clear();
      instance?.remove();
      setMap(null);
    };
  }, [variant]);

  // Um pin por café, sincronizado por id.
  useEffect(() => {
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    const current = markers.current;
    const ids = new Set(cafes.map((c) => c.id));

    current.forEach((marker, id) => {
      if (ids.has(id)) return;
      marker.remove();
      current.delete(id);
    });
    for (const cafe of cafes) {
      if (current.has(cafe.id)) continue;
      const el = createPinElement(cafe, variant, handlers);
      current.set(cafe.id, new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([cafe.lng, cafe.lat]).addTo(map));
    }
  }, [map, cafes, variant]);

  // Estado ativo (hover ou seleção) só troca um atributo: o CSS faz o resto.
  useEffect(() => {
    if (!map) return;
    markers.current.forEach((marker, id) => {
      marker.getElement().dataset.active = String(id === hoveredId || id === selectedId);
    });
  }, [map, cafes, hoveredId, selectedId]);

  // Preview só no mapa navegável da home: o mini mapa usa `selectedId` só para pintar o pin.
  const previewCafe =
    variant === "full" && onSelect ? cafes.find((c) => c.id === selectedId) : undefined;
  const [anchor, setAnchor] = useState<PreviewAnchor | null>(null);

  // O preview acompanha o pin em pan e zoom; a regra de virar é recalculada a cada quadro.
  const acompanhaPin = previewPlacement === "pin";
  useEffect(() => {
    if (!map || !previewCafe || !acompanhaPin) {
      setAnchor(null);
      return;
    }
    const { lng, lat } = previewCafe;
    const update = () => {
      const { x, y } = map.project([lng, lat]);
      const { clientWidth: width, clientHeight: height } = map.getContainer();
      setAnchor({ pin: { x, y }, size: { width, height } });
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, previewCafe, acompanhaPin]);

  // Clique no mapa vazio fecha o preview. O Mapbox só dispara `click` sem
  // arrasto; clique em pin também chega aqui e é ignorado.
  useEffect(() => {
    if (!map) return;
    const close = (e: { originalEvent: MouseEvent }) => {
      if ((e.originalEvent.target as Element | null)?.closest(".mapboxgl-marker")) return;
      handlers.current.onClose?.();
    };
    map.on("click", close);
    return () => {
      map.off("click", close);
    };
  }, [map]);

  // X e Esc devolvem o foco ao pin que abriu o preview.
  function closePreview() {
    if (!previewCafe) return;
    markers.current.get(previewCafe.id)?.getElement().focus();
    onClose?.();
  }

  const placement = anchor && placePreview(anchor.pin, anchor.size);

  // Enter no pin abre o preview e leva o foco até ele: no DOM, o preview vem
  // depois de todos os pins, e o Tab seguinte os percorreria antes de chegar.
  const previewLink = useRef<HTMLAnchorElement>(null);
  const previewAbertoId = previewCafe && (!acompanhaPin || placement) ? previewCafe.id : null;
  useEffect(() => {
    if (!previewAbertoId) return;
    if (document.activeElement === markers.current.get(previewAbertoId)?.getElement()) {
      previewLink.current?.focus();
    }
  }, [previewAbertoId]);

  return (
    <div
      // O canvas ocupa o contêiner inteiro: o anel de foco por fora seria cortado.
      className={`relative overflow-hidden bg-map-bg [&_canvas:focus-visible]:-outline-offset-2 ${className}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") closePreview();
      }}
    >
      {/* `size-full`, não `absolute`: o CSS do Mapbox força `position: relative`. */}
      <div ref={containerRef} className="size-full" />
      {previewCafe && !acompanhaPin && (
        // Card do pin no mobile, acima do FAB (o design o põe a 92 px do pé).
        <CafeMapPreview
          cafe={previewCafe}
          linkRef={previewLink}
          onClose={closePreview}
          style={{ left: 14, right: 14, bottom: 92, width: "auto" }}
        />
      )}
      {previewCafe && acompanhaPin && placement && (
        <CafeMapPreview
          cafe={previewCafe}
          linkRef={previewLink}
          onClose={closePreview}
          style={{
            left: placement.left,
            top: placement.y,
            transform: placement.placement === "above" ? "translateY(-100%)" : undefined,
          }}
        />
      )}
      {variant === "full" && map && (
        <div className="absolute right-[18px] top-[18px] flex flex-col overflow-hidden rounded-[10px] border border-map-control-line bg-map-control">
          <button
            type="button"
            aria-label="Aproximar"
            onClick={() => map.zoomIn()}
            className={`${ZOOM_BUTTON} border-b border-map-control-line`}
          >
            +
          </button>
          <button type="button" aria-label="Afastar" onClick={() => map.zoomOut()} className={ZOOM_BUTTON}>
            −
          </button>
        </div>
      )}
    </div>
  );
}

function createPinElement(
  cafe: Cafe,
  variant: "full" | "mini",
  handlers: { current: Pick<Props, "onHover" | "onSelect"> },
): HTMLElement {
  const interactive = Boolean(handlers.current.onSelect);
  const el = document.createElement(interactive ? "button" : "div");
  el.className = `group block data-[active=true]:z-10 ${interactive ? "cursor-pointer" : ""}`;
  el.setAttribute("aria-label", cafe.nome);
  if (interactive) {
    el.setAttribute("type", "button");
    el.addEventListener("click", () => handlers.current.onSelect?.(cafe.id));
  } else {
    el.setAttribute("role", "img");
  }
  // Foco equivale a hover: quem navega por teclado também vê o card destacado.
  for (const [on, off] of [["mouseenter", "mouseleave"], ["focus", "blur"]] as const) {
    el.addEventListener(on, () => handlers.current.onHover?.(cafe.id));
    el.addEventListener(off, () => handlers.current.onHover?.(null));
  }

  const inner = document.createElement("span");
  inner.className = `block origin-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,.5)] transition-transform duration-[180ms] ${PIN_SCALE[variant]}`;
  inner.innerHTML = PIN_SVG;
  el.append(inner);
  return el;
}
