"use client";

// Única fronteira com o Mapbox (regra 1 do CLAUDE.md): nenhum outro arquivo
// importa `mapbox-gl`. Quem usa o mapa fala só a língua desta interface.
import "mapbox-gl/dist/mapbox-gl.css";

import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { CafeMapPreview } from "@/components/cafe-map-preview";
import { PilulaDoMapa } from "@/components/pilula-do-mapa";
import type { Cafe } from "@/lib/cafe";
import type { Coordenadas } from "@/lib/cafe-distance";
import { estadoAgora } from "@/lib/cafe-hours";
import { enquadramentoFantasma } from "@/lib/enquadramento-fantasma";
import { circuloDoRaio, FIT_PADDING, limitesDoRaio, MAX_ZOOM } from "@/lib/map-enquadramento";
import { placePreview } from "@/lib/map-preview-placement";

/** O que um pin precisa. O mini mapa do admin (#53) mostra um café que ainda não existe. */
type Pin = Pick<Cafe, "id" | "nome" | "lat" | "lng">;

/** O raio de distância ligado (#161): o círculo em volta de quem usa, com o mapa enquadrado nele. */
export type RaioNoMapa = { centro: Coordenadas; km: number };

type Props = (
  | {
      /** Mapa navegável da home: o preview do pin precisa do café inteiro. */
      variant?: "full";
      cafes: Cafe[];
      /** Ponto "Você está aqui". Só na home: o detalhe já diz "1,2 km de você". */
      userPosition?: Coordenadas | null;
      /**
       * Pontos a enquadrar no lugar de todos os cafés (a posição e os mais próximos, #96).
       * Uma vez por mapa, e só se a pessoa ainda não arrastou nem deu zoom.
       */
      focus?: Coordenadas[] | null;
      /**
       * Círculo do raio (#165). Ligar ou trocar enquadra nele, mesmo depois de a pessoa mexer
       * (o filtro é espacial), e vence o `focus`; desligar não mexe na câmera.
       */
      raio?: RaioNoMapa | null;
      /** Instante da linha de horário do preview (#163) e dos pins apagados (#165): o mesmo dos cards. */
      agora: Date;
    }
  | {
      /** Localizador estático (detalhe e formulário do admin): acompanha a posição se ela mudar. */
      variant: "mini";
      cafes: Pin[];
      userPosition?: never;
      focus?: never;
      raio?: never;
      agora?: never;
    }
) & {
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

/** `pronto` no `load` do Mapbox; `indisponivel` sem token, sem WebGL, com o import ou o estilo falhando. */
type Estado = "carregando" | "pronto" | "indisponivel";

type PreviewAnchor = { pin: { x: number; y: number }; size: { width: number; height: number } };

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Sem cafés para enquadrar: centro de Recife.
const RECIFE: [number, number] = [-34.9, -8.06];
const MINI_ZOOM = 15;
const SEM_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
// Teto do Mapbox, que o `fitBounds` usa sem `maxZoom`: o raio de 1 km enquadra mais perto que o `MAX_ZOOM`.
const ZOOM_DO_MAPBOX = 22;

// Círculo do raio (#165) em `brasa`: 2 px de contorno, 8% de preenchimento (6,63:1 no `map-bg`).
const BRASA = "#E58A5F";
const RAIO_FONTE = "raio";

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
// então escala e cores vivem no filho, guiadas por `data-active` e `data-fechado` no externo.
// Fechado agora (#165), "luz apagada": `map-control` com contorno e xícara `pin-apagado`; ativo,
// contorno `brasa` e xícara `map-control-fg`, sem virar terracota (o estado continua à vista).
const PIN_SVG = `<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
<path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.6 16 39 16 39s15-12.4 15-23.2C31 7.6 24.3 1 16 1z" stroke-width="1.5" class="fill-map-pin stroke-espresso transition-colors group-data-[active=true]:fill-terracotta group-data-[active=true]:stroke-on-terracotta group-data-[fechado=true]:fill-map-control group-data-[fechado=true]:stroke-pin-apagado group-[[data-active=true][data-fechado=true]]:fill-map-control group-[[data-active=true][data-fechado=true]]:stroke-brasa group-[[data-active=true][data-fechado=true]]:stroke-[2.2]"/>
<g transform="translate(8.6 8.2) scale(0.62)" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="stroke-espresso transition-colors group-data-[active=true]:stroke-on-terracotta group-data-[fechado=true]:stroke-pin-apagado group-[[data-active=true][data-fechado=true]]:stroke-map-control-fg">
<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>
</g></svg>`;

// Ponto de quem usa: o azul de posição dos apps de mapa (não lembra pin nem pin ativo), borda `cream`.
// Abaixo dos pins (o `z-[1]` deles vence a ordem no DOM) e sem receber clique.
const VOCE_HTML = `<span class="absolute inset-0 rounded-full bg-map-voce/20 motion-safe:animate-ping"></span>
<span class="relative block size-4 rounded-full border-[3px] border-cream bg-map-voce shadow-[0_1px_4px_rgba(0,0,0,.5)]"></span>`;

// Pin-fantasma (#142): círculo de 22 px no centro da cabeça do pin, 24 px acima da ponta — 29 no
// mini, onde o pin é sempre o selecionado (escala 1,2, `PIN_SCALE`). Pulso defasado em 180 ms por
// café; atraso negativo, para todos já entrarem defasados. Parado (`opacity-30`) com `prefers-reduced-motion`.
const FANTASMA =
  "absolute size-[22px] -translate-x-1/2 rounded-full bg-map-pin opacity-30 motion-safe:animate-fantasma";
const FANTASMA_ALTURA = {
  full: "-translate-y-[calc(50%+24px)]",
  mini: "-translate-y-[calc(50%+29px)]",
};
const FASE_DO_FANTASMA_MS = 180;
const PULSO_DO_FANTASMA_MS = 1800;

const PIN_SCALE = {
  full: "group-data-[active=true]:scale-[1.3]",
  mini: "group-data-[active=true]:scale-[1.2]",
};

const LABEL = { full: "Mapa dos cafés", mini: "Mapa com a localização do café" };

// O canvas ocupa o contêiner inteiro: o anel de foco por fora seria cortado.
// Os controles do Mapbox (atribuição) trocam o brilho azul dele pelo anel da paleta;
// `!` porque o seletor do CSS do Mapbox empata em especificidade e a ordem de carga não é garantida.
const FOCO_NA_PALETA =
  "[&_canvas:focus-visible]:-outline-offset-2 [&_.mapboxgl-ctrl_button:focus-visible]:!shadow-none [&_.mapboxgl-ctrl_button:focus-visible]:!outline [&_.mapboxgl-ctrl_button:focus-visible]:!outline-2 [&_.mapboxgl-ctrl_button:focus-visible]:!outline-terracotta";

const ZOOM_BUTTON =
  "flex size-[38px] items-center justify-center text-lg leading-none text-map-control-fg transition-colors hover:bg-map-control-hover focus-visible:-outline-offset-2";

/**
 * Mapa Mapbox com um pin por café. Só roda no cliente: a lib é carregada no
 * `useEffect`, então o servidor renderiza o fundo com "Carregando mapa…". O
 * mapa entra com fade no `load`; se não vier (sem token, sem WebGL, import ou
 * estilo falhando), fica "Mapa indisponível" — a página segue funcionando.
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
  userPosition = null,
  focus = null,
  raio = null,
  agora,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const molduraRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [estado, setEstado] = useState<Estado>(TOKEN ? "carregando" : "indisponivel");
  const markers = useRef(new Map<string, Marker>());
  const mapboxRef = useRef<typeof import("mapbox-gl").default | null>(null);

  // Callbacks mais recentes sem recriar os pins a cada render do pai.
  const handlers = useRef({ onHover, onSelect, onClose });
  handlers.current = { onHover, onSelect, onClose };

  // Enquadramento só na criação: filtrar não deve fazer o mapa pular.
  const initialCafes = useRef(cafes);
  // O foco mais recente: o mapa que nasce depois da posição (mobile) já nasce nele.
  const focusAtual = useRef(focus);
  focusAtual.current = focus;
  const enquadrou = useRef(false);
  // O raio mais recente (o mapa que nasce depois da escolha, no mobile, já nasce nele) e o último enquadrado.
  const raioAtual = useRef(raio);
  raioAtual.current = raio;
  const raioEnquadrado = useRef<string | null>(null);
  // Arrastou, deu zoom (gesto, teclado ou +/−): o mapa fica onde a pessoa deixou.
  const mexeu = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!TOKEN || !container) return;
    let cancelled = false;
    let instance: MapboxMap | undefined;
    setEstado("carregando");

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return;
      mapboxRef.current = mapboxgl;
      const cafes = initialCafes.current;
      const isMini = variant === "mini";
      const raioInicial = isMini ? null : raioAtual.current;
      const foco = isMini || raioInicial ? null : focusAtual.current;
      const pontos = isMini ? [] : raioInicial ? limitesDoRaio(raioInicial.centro, raioInicial.km) : (foco ?? cafes);
      const bounds = pontos.length > 0 ? limites(pontos) : undefined;
      enquadrou.current = foco !== null || raioInicial !== null;
      raioEnquadrado.current = raioInicial && chaveDoRaio(raioInicial);
      mexeu.current = false;

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
            ? { bounds, fitBoundsOptions: { padding: FIT_PADDING, maxZoom: raioInicial ? ZOOM_DO_MAPBOX : MAX_ZOOM } }
            : { center: cafes[0] ? [cafes[0].lng, cafes[0].lat] : RECIFE, zoom: isMini ? MINI_ZOOM : 12 }),
        });
      } catch {
        // WebGL indisponível (o Mapbox v3 lança no construtor).
        setEstado("indisponivel");
        return;
      }

      // Erro antes do `load` (token, estilo, `api.mapbox.com` fora) derruba o mapa;
      // depois dele (um tile que falhou), o mapa já está na tela e fica.
      let carregou = false;
      instance.once("load", () => {
        carregou = true;
        setEstado("pronto");
      });
      instance.on("error", (e) => {
        // Com um ouvinte, o Mapbox deixa de mandar o erro ao console: mantém o diagnóstico.
        console.error(e.error);
        if (!carregou) setEstado("indisponivel");
      });

      instance.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
      // Gesto, teclado e os botões +/− (que repassam o clique) trazem `originalEvent`;
      // o `fitBounds` daqui não traz, e não conta como mexer.
      instance.on("movestart", (e) => {
        if (e.originalEvent) mexeu.current = true;
      });
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
    }).catch(() => {
      // Chunk do `mapbox-gl` que não chegou (rede caiu, bloqueio).
      if (!cancelled) setEstado("indisponivel");
    });

    const current = markers.current;
    return () => {
      cancelled = true;
      current.clear();
      instance?.remove();
      setMap(null);
    };
  }, [variant]);

  // Tamanho do mapa para os pins-fantasma, só enquanto carrega (no servidor, sem fantasma).
  const [tamanho, setTamanho] = useState<{ largura: number; altura: number } | null>(null);
  useEffect(() => {
    const moldura = molduraRef.current;
    if (estado !== "carregando" || !moldura || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setTamanho({ largura: moldura.clientWidth, altura: moldura.clientHeight });
    });
    observer.observe(moldura);
    return () => observer.disconnect();
  }, [estado]);

  // Onde os pins vão aparecer, pelo mesmo enquadramento da criação do mapa: o foco (#96), se
  // houver (chegando durante a carga, o `fitBounds` dele também roda antes do `load`), senão os
  // cafés iniciais. Os fantasmas são os cafés de agora. O mini fica no café, sem padding.
  const fantasmas = useMemo(() => {
    if (estado !== "carregando" || !tamanho) return [];
    if (variant === "mini") {
      const cafe = cafes.slice(0, 1);
      return enquadramentoFantasma(cafe, cafe, { ...tamanho, padding: SEM_PADDING, maxZoom: MINI_ZOOM });
    }
    if (raio) {
      return enquadramentoFantasma(limitesDoRaio(raio.centro, raio.km), cafes, {
        ...tamanho,
        padding: FIT_PADDING,
        maxZoom: ZOOM_DO_MAPBOX,
      });
    }
    return enquadramentoFantasma(focus ?? initialCafes.current, cafes, {
      ...tamanho,
      padding: FIT_PADDING,
      maxZoom: MAX_ZOOM,
    });
  }, [estado, tamanho, variant, cafes, focus, raio]);

  // Um pin por café, sincronizado por id. Pin que já existe vai para a posição nova, se mudou.
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
      const existente = current.get(cafe.id);
      if (existente) {
        const { lng, lat } = existente.getLngLat();
        if (lng !== cafe.lng || lat !== cafe.lat) existente.setLngLat([cafe.lng, cafe.lat]);
        continue;
      }
      const el = createPinElement(cafe, variant, handlers);
      current.set(cafe.id, new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([cafe.lng, cafe.lat]).addTo(map));
    }
  }, [map, cafes, variant]);

  // A posição chega depois de o mapa aparecer (na primeira visita, só depois do "Permitir"):
  // aproxima uma vez, se a pessoa ainda não mexeu. Com `prefers-reduced-motion`, o próprio
  // Mapbox troca a animação por um salto (nada aqui pede `essential`).
  useEffect(() => {
    if (!map || !focus || enquadrou.current || mexeu.current || raioAtual.current) return;
    enquadrou.current = true;
    map.fitBounds(limites(focus), { padding: FIT_PADDING, maxZoom: MAX_ZOOM });
  }, [map, focus]);

  // Raio ligado ou trocado (#165): enquadra no círculo, mesmo que a pessoa tenha mexido — o filtro
  // é espacial, e o círculo fora da tela não diria nada. Desligar não mexe na câmera.
  const chave = raio && chaveDoRaio(raio);
  useEffect(() => {
    const atual = raioAtual.current;
    if (!map || !chave || !atual) {
      raioEnquadrado.current = null;
      return;
    }
    if (chave === raioEnquadrado.current) return;
    raioEnquadrado.current = chave;
    enquadrou.current = true;
    map.fitBounds(limites(limitesDoRaio(atual.centro, atual.km)), { padding: FIT_PADDING });
  }, [map, chave]);

  // O círculo é uma camada do estilo (abaixo dos pins, que são HTML): só depois do `load`.
  const pronto = estado === "pronto";
  useEffect(() => {
    const atual = raioAtual.current;
    if (!map || !pronto) return;
    const dados: Parameters<GeoJSONSource["setData"]>[0] = {
      type: "FeatureCollection",
      features: atual
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [circuloDoRaio(atual.centro, atual.km).map((p) => [p.lng, p.lat])],
              },
            },
          ]
        : [],
    };
    const fonte = map.getSource<GeoJSONSource>(RAIO_FONTE);
    if (fonte) {
      fonte.setData(dados);
      return;
    }
    map.addSource(RAIO_FONTE, { type: "geojson", data: dados });
    map.addLayer({ id: "raio-preenchimento", type: "fill", source: RAIO_FONTE, paint: { "fill-color": BRASA, "fill-opacity": 0.08 } });
    map.addLayer({ id: "raio-contorno", type: "line", source: RAIO_FONTE, paint: { "line-color": BRASA, "line-width": 2 } });
  }, [map, pronto, chave]);

  // Ponto parado de quem usa, sem `GeolocateControl` (pediria a permissão de novo, por
  // conta própria). Quem está longe não afasta o mapa: o enquadramento vem de `focus`.
  const voceLat = userPosition?.lat;
  const voceLng = userPosition?.lng;
  useEffect(() => {
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || voceLat === undefined || voceLng === undefined) return;
    const el = document.createElement("div");
    // Inline, não classe: o Marker escreve `pointer-events: auto` no style, salvo se já houver um valor ali.
    el.style.pointerEvents = "none";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Você está aqui");
    el.innerHTML = VOCE_HTML;
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([voceLng, voceLat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, voceLat, voceLng]);

  // O mini mapa segue o café: no formulário do admin, lat/lng mudam enquanto são digitados.
  // O `full` nunca recentraliza — filtrar não deve fazer o mapa pular.
  const centro = variant === "mini" && cafes[0] ? `${cafes[0].lng},${cafes[0].lat}` : null;
  useEffect(() => {
    if (!map || !centro) return;
    const [lng, lat] = centro.split(",").map(Number);
    map.jumpTo({ center: [lng, lat] });
  }, [map, centro]);

  // Estado ativo (hover ou seleção) só troca um atributo: o CSS faz o resto.
  useEffect(() => {
    if (!map) return;
    markers.current.forEach((marker, id) => {
      marker.getElement().dataset.active = String(id === hoveredId || id === selectedId);
    });
  }, [map, cafes, hoveredId, selectedId]);

  // Fechados agora (#165), pelo mesmo instante dos cards: muda no clique (#162), sem recriar os pins.
  // Sem informação hoje fica com o pin normal (não se sabe se está fechado). O mini mapa não apaga.
  const fechados = useMemo(
    () =>
      variant === "full" && agora
        ? new Set((cafes as Cafe[]).filter((c) => estadoAgora(c.horario_funcionamento, agora).estado === "fechado").map((c) => c.id))
        : new Set<string>(),
    [variant, cafes, agora],
  );
  useEffect(() => {
    if (!map) return;
    const nomes = new Map(cafes.map((c) => [c.id, c.nome]));
    markers.current.forEach((marker, id) => {
      const el = marker.getElement();
      const fechado = fechados.has(id);
      el.dataset.fechado = String(fechado);
      el.setAttribute("aria-label", fechado ? `${nomes.get(id)}, fechado agora` : (nomes.get(id) ?? ""));
    });
  }, [map, cafes, fechados]);

  // Preview só no mapa navegável da home: o mini mapa usa `selectedId` só para pintar o pin.
  // Fora do `mini`, `cafes` é `Cafe[]` (o tipo das props garante; a desestruturação perde o vínculo).
  const previewCafe =
    variant !== "mini" && onSelect ? (cafes as Cafe[]).find((c) => c.id === selectedId) : undefined;
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
      ref={molduraRef}
      className={`relative overflow-hidden bg-map-bg ${FOCO_NA_PALETA} ${className}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") closePreview();
      }}
    >
      {/* `invisible` até o `load`: canvas e pins fora do Tab enquanto o estilo não chega.
          No invólucro: o `className` do contêiner é do Mapbox (`mapboxgl-map`), e o React o apagaria. */}
      <div
        className={`size-full motion-safe:transition-opacity motion-safe:duration-500 ${
          estado === "pronto" ? "" : "invisible opacity-0"
        }`}
      >
        {/* `size-full`, não `absolute`: o CSS do Mapbox força `position: relative`. */}
        <div ref={containerRef} className="size-full" />
      </div>
      {fantasmas.length > 0 && (
        // Decorativos e sem clique: abaixo da pílula, como no design.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {fantasmas.map(({ x, y }, i) => (
            <span
              key={i}
              data-fantasma=""
              className={`${FANTASMA} ${FANTASMA_ALTURA[variant]}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `-${(i * FASE_DO_FANTASMA_MS) % PULSO_DO_FANTASMA_MS}ms`,
              }}
            />
          ))}
        </div>
      )}
      {estado === "carregando" && (
        // O carregamento não se anuncia: a lista já está usável. A falha fica legível, sem interromper.
        <span aria-hidden="true">
          <PilulaDoMapa estado="carregando" />
        </span>
      )}
      {estado === "indisponivel" && <PilulaDoMapa estado="indisponivel" />}
      {previewCafe && !acompanhaPin && (
        // Card do pin no mobile, acima do FAB (o design o põe a 92 px do pé).
        <CafeMapPreview
          cafe={previewCafe}
          agora={agora}
          linkRef={previewLink}
          onClose={closePreview}
          style={{ left: 14, right: 14, bottom: 92, width: "auto" }}
        />
      )}
      {previewCafe && acompanhaPin && placement && (
        <CafeMapPreview
          cafe={previewCafe}
          agora={agora}
          linkRef={previewLink}
          onClose={closePreview}
          style={{
            left: placement.left,
            top: placement.y,
            transform: placement.placement === "above" ? "translateY(-100%)" : undefined,
          }}
        />
      )}
      {variant === "full" && map && estado === "pronto" && (
        <div className="absolute right-[18px] top-[18px] flex flex-col overflow-hidden rounded-[10px] border border-map-control-line bg-map-control">
          <button
            type="button"
            aria-label="Aproximar"
            onClick={(e) => map.zoomIn(undefined, { originalEvent: e.nativeEvent })}
            className={`${ZOOM_BUTTON} border-b border-map-control-line`}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Afastar"
            onClick={(e) => map.zoomOut(undefined, { originalEvent: e.nativeEvent })}
            className={ZOOM_BUTTON}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}

/** O que muda o círculo: trocar o raio ou a posição reenquadra; o mesmo raio de novo, não. */
function chaveDoRaio({ centro, km }: RaioNoMapa): string {
  return `${centro.lat},${centro.lng},${km}`;
}

/** Retângulo (sudoeste, nordeste) que contém todos os pontos. */
function limites(pontos: readonly Coordenadas[]): [[number, number], [number, number]] {
  const lngs = pontos.map((p) => p.lng);
  const lats = pontos.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function createPinElement(
  cafe: Pin,
  variant: "full" | "mini",
  handlers: { current: Pick<Props, "onHover" | "onSelect"> },
): HTMLElement {
  const interactive = Boolean(handlers.current.onSelect);
  const el = document.createElement(interactive ? "button" : "div");
  // Acima do "Você está aqui"; os abertos acima dos apagados quando se sobrepõem (#165), o ativo acima de todos.
  el.className = `group block z-[2] data-[active=false]:data-[fechado=true]:z-[1] data-[active=true]:z-10 ${interactive ? "cursor-pointer" : ""}`;
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
