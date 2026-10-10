import { caminhoDoCafe, type Cafe, type DiaSemana } from "./cafe";
import { FECHADO, horarioDaSemana } from "./cafe-hours";
import { formatarPreco, periodoDaEdicao, rotuloDeParticipantes, type Edicao } from "./festival";
import { faixaPrecoNome, instagramUrl, localLabel } from "./format";
import { isHttpUrl } from "./url";

/**
 * SEO das páginas públicas — PRD › "SEO". Puro: monta título, descrição e JSON-LD a
 * partir do café; quem liga isso ao Next é a rota.
 */

export const SITE_NOME = "Mapa do Café";
export const SITE_DESCRICAO = "Diretório de cafés especiais em Recife, Olinda e Jaboatão dos Guararapes.";

/**
 * Campos de Open Graph comuns a todas as páginas. O `openGraph` de uma página
 * substitui o do layout por inteiro (o Next não mescla em profundidade): quem
 * define o seu repete esta base.
 */
export const OPEN_GRAPH_BASE = { siteName: SITE_NOME, locale: "pt_BR", type: "website" } as const;

/** `<title>` do detalhe: "81 Coffee Co. · Mapa do Café". */
export function tituloCafe(cafe: Pick<Cafe, "nome">): string {
  return `${cafe.nome} · ${SITE_NOME}`;
}

/**
 * Meta description: "Café especial · Graças, Recife · preço moderado ($$).
 * Endereço, horário e comodidades no Mapa do Café." Sem preposição antes do
 * bairro ("nas Graças", "no Pina"): o banco não sabe qual. Sem o selo de
 * festival: o snippet do buscador seguiria citando-o depois da edição.
 */
export function descricaoCafe(cafe: Pick<Cafe, "bairro" | "cidade" | "faixa_preco">): string {
  const partes = [
    "Café especial",
    `${cafe.bairro}, ${cafe.cidade}`,
    `preço ${faixaPrecoNome(cafe.faixa_preco).toLowerCase()} (${cafe.faixa_preco})`,
  ];
  return `${partes.join(" · ")}. Endereço, horário e comodidades no ${SITE_NOME}.`;
}

/** Dados estruturados `CafeOrCoffeeShop` (schema.org) do detalhe. `url`: o canonical. */
export function jsonLdCafe(cafe: Cafe, url: string): Record<string, unknown> {
  const horas = horarioEstruturado(cafe.horario_funcionamento);
  const instagram = instagramUrl(cafe);
  const fotos = cafe.fotos.filter(isHttpUrl);
  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: cafe.nome,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: cafe.endereco,
      addressLocality: cafe.cidade,
      addressRegion: "PE",
      addressCountry: "BR",
    },
    geo: { "@type": "GeoCoordinates", latitude: cafe.lat, longitude: cafe.lng },
    priceRange: cafe.faixa_preco,
    ...(horas.length > 0 && { openingHoursSpecification: horas }),
    ...(cafe.telefone && { telephone: cafe.telefone }),
    ...(instagram && { sameAs: [instagram] }),
    // Só foto real: o placeholder listrado não é imagem do café.
    ...(fotos.length > 0 && { image: fotos }),
  };
}

type EdicaoSeo = Pick<Edicao, "festival" | "ano" | "inicio" | "fim" | "descricao" | "preco">;

const nomeDaEdicao = (edicao: Pick<Edicao, "festival" | "ano">) => `${edicao.festival.nome} ${edicao.ano}`;

/** `<title>` da página do festival: "Eu Amo Café 2026 · Mapa do Café". */
export function tituloEdicao(edicao: Pick<Edicao, "festival" | "ano">): string {
  return `${nomeDaEdicao(edicao)} · ${SITE_NOME}`;
}

/**
 * Meta description da página do festival: "Combos do Eu Amo Café 2026: 18 out
 * a 15 nov 2026, 18 cafés participantes, combo a R$ 34,90." Gerada, não a
 * `descricao` da edição: essa é escrita para a faixa, sem tamanho garantido.
 */
export function descricaoEdicao(edicao: EdicaoSeo, participantes: number): string {
  const partes = [periodoDaEdicao(edicao), rotuloDeParticipantes(participantes)];
  if (edicao.preco !== null) partes.push(`combo a ${formatarPreco(edicao.preco)}`);
  return `Combos do ${nomeDaEdicao(edicao)}: ${partes.join(", ")}.`;
}

/** Dados estruturados `Festival` (schema.org) da página da edição. `url`: o canonical. */
export function jsonLdEdicao(edicao: EdicaoSeo, url: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Festival",
    name: nomeDaEdicao(edicao),
    url,
    startDate: edicao.inicio,
    endDate: edicao.fim,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(edicao.descricao && { description: edicao.descricao }),
    // Os combos ficam nos cafés de Recife, Olinda e Jaboatão; o festival é de Recife.
    location: {
      "@type": "Place",
      name: "Recife",
      address: { "@type": "PostalAddress", addressLocality: "Recife", addressRegion: "PE", addressCountry: "BR" },
    },
    ...(edicao.preco !== null && {
      offers: { "@type": "Offer", price: (edicao.preco / 100).toFixed(2), priceCurrency: "BRL", url },
    }),
  };
}

/** Tamanho da imagem gerada (`/cafes/[slug]/og` e a da home): o 1,91:1 do Open Graph. */
export const OG_LARGURA = 1200;
export const OG_ALTURA = 630;

/**
 * Imagem de compartilhamento do café (Open Graph e Twitter Card). Com foto, a
 * capa como está — a mesma do carrossel, em WebP e na proporção dela. Sem foto,
 * a imagem gerada em `/cafes/[slug]/og`, pelo caminho: o `metadataBase` a torna
 * absoluta.
 */
export function imagemCompartilhamento(cafe: Pick<Cafe, "slug" | "fotos" | "nome" | "bairro" | "cidade">) {
  const alt = `${cafe.nome} · ${localLabel(cafe)}`;
  const capa = cafe.fotos.find(isHttpUrl);
  if (capa) return { url: capa, type: "image/webp", alt };
  return {
    url: `${caminhoDoCafe(cafe)}/og`,
    alt,
    width: OG_LARGURA,
    height: OG_ALTURA,
    type: "image/png",
  };
}

const DAY_OF_WEEK: Record<DiaSemana, string> = {
  segunda: "Monday",
  terca: "Tuesday",
  quarta: "Wednesday",
  quinta: "Thursday",
  sexta: "Friday",
  sabado: "Saturday",
  domingo: "Sunday",
};

const TURNO = /^(\d{2}:\d{2}) – (\d{2}:\d{2})$/;

/**
 * Um `OpeningHoursSpecification` por turno. "Fechado" vira 00:00–00:00 (como o
 * Google pede para "fechado o dia todo"); dia não informado ou fora do formato
 * fica de fora — é "não sabemos", não "fechado".
 */
function horarioEstruturado(horario: unknown) {
  return horarioDaSemana(horario).flatMap(({ dia, horario }) => {
    if (horario === null) return [];
    const turnos =
      horario === FECHADO ? [["00:00", "00:00"]] : horario.split(", ").map((turno) => TURNO.exec(turno)?.slice(1, 3));
    if (!turnos.every((t): t is string[] => t !== undefined)) return [];
    return turnos.map(([opens, closes]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_OF_WEEK[dia],
      opens,
      closes,
    }));
  });
}
