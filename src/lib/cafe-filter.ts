import type { Cafe, FaixaPreco } from "./cafe";

/** Filtros booleanos: chave do estado → campo do café e param da URL (`?pets=true`). */
const FILTROS_BOOLEANOS = {
  ascape: { campo: "selo_ascape", param: "ascape" },
  pets: { campo: "aceita_pets", param: "pets" },
  estacionamento: { campo: "tem_estacionamento", param: "estacionamento" },
  coffeeOffice: { campo: "permite_coffee_office", param: "coffee_office" },
} as const satisfies Record<string, { campo: keyof Cafe; param: string }>;

export type FiltroBooleano = keyof typeof FILTROS_BOOLEANOS;

export type CafeFilters = Record<FiltroBooleano, boolean> & {
  /** Slugs de bairro aceitos (união); vazio = filtro desligado. */
  bairros: string[];
  /** Faixas aceitas (união); vazio = filtro desligado. */
  precos: FaixaPreco[];
  /** Busca livre por nome ou bairro; vazio = filtro desligado. */
  q: string;
};

export const FILTROS_VAZIOS: CafeFilters = {
  ascape: false,
  pets: false,
  estacionamento: false,
  coffeeOffice: false,
  bairros: [],
  precos: [],
  q: "",
};

const CHAVES = Object.keys(FILTROS_BOOLEANOS) as FiltroBooleano[];

/** Ordem canônica das faixas, na URL e no estado. */
export const FAIXAS: readonly FaixaPreco[] = ["$", "$$", "$$$"];

/** Lista vazia aceita qualquer valor; senão, o valor precisa estar nela. */
const aceita = <T>(lista: readonly T[], valor: T) => lista.length === 0 || lista.includes(valor);

/**
 * Interseção dos filtros ligados — dentro de bairro e de preço, a união das
 * opções marcadas; na busca, cada palavra precisa casar com o nome ou o
 * bairro. Filtro desligado não exclui ninguém. Preserva a ordem.
 */
export function filtrarCafes(cafes: Cafe[], filters: CafeFilters): Cafe[] {
  const ligados = CHAVES.filter((chave) => filters[chave]);
  const palavras = normalizar(filters.q).split(/\s+/).filter(Boolean);
  return cafes.filter(
    (cafe) =>
      ligados.every((chave) => cafe[FILTROS_BOOLEANOS[chave].campo]) &&
      aceita(filters.bairros, cafe.bairro_slug) &&
      aceita(filters.precos, cafe.faixa_preco) &&
      casaBusca(cafe, palavras),
  );
}

/** Sem acento e em minúsculas: "Graças" e "GRACAS" viram "gracas". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

/** Sem palavras (termo vazio ou só espaços), a busca está desligada. */
function casaBusca(cafe: Cafe, palavras: string[]): boolean {
  const campos = [normalizar(cafe.nome), normalizar(cafe.bairro)];
  return palavras.every((palavra) => campos.some((campo) => campo.includes(palavra)));
}

/** Leitura mínima de params: `URLSearchParams` e o `useSearchParams()` do Next. */
type ParamsLike = Pick<URLSearchParams, "get">;

/** "a,b,,c" → ["a", "b", "c"]; param ausente → []. */
function lista(valor: string | null): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

/**
 * Lê o estado da URL; o que não reconhece, ignora em silêncio. Com
 * `bairrosValidos`, slug que não é de nenhum café some (link antigo de bairro
 * que saiu do diretório vira filtro desligado, não lista vazia).
 */
export function parseFilters(params: ParamsLike, bairrosValidos?: readonly string[]): CafeFilters {
  const filters = { ...FILTROS_VAZIOS };
  for (const chave of CHAVES) {
    filters[chave] = params.get(FILTROS_BOOLEANOS[chave].param) === "true";
  }
  const precos = lista(params.get("preco"));
  filters.precos = FAIXAS.filter((faixa) => precos.includes(faixa));
  filters.bairros = Array.from(new Set(lista(params.get("bairro"))))
    .filter((slug) => !bairrosValidos || bairrosValidos.includes(slug))
    .sort();
  filters.q = params.get("q")?.trim() ?? "";
  return filters;
}

/**
 * Query string (sem `?`) com os filtros escritos sobre `base`: params de
 * filtro são reescritos (só os ligados); os alheios (`utm_*`, os de filtros
 * futuros) ficam como estavam. Listas saem em ordem canônica — a URL não
 * depende da ordem dos cliques — e com `$` e `,` legíveis (`preco=$,$$`):
 * os dois são válidos em query string, e quem lê decodifica igual.
 */
export function serializeFilters(filters: CafeFilters, base?: URLSearchParams): string {
  const params = new URLSearchParams(base);
  for (const chave of CHAVES) {
    const { param } = FILTROS_BOOLEANOS[chave];
    if (filters[chave]) params.set(param, "true");
    else params.delete(param);
  }
  definirLista(params, "bairro", [...filters.bairros].sort());
  definirLista(params, "preco", FAIXAS.filter((faixa) => filters.precos.includes(faixa)));
  const q = filters.q.trim();
  if (q) params.set("q", q);
  else params.delete("q");
  return params.toString().replace(/%24/g, "$").replace(/%2C/g, ",");
}

function definirLista(params: URLSearchParams, param: string, valores: string[]) {
  if (valores.length > 0) params.set(param, valores.join(","));
  else params.delete(param);
}

/** Algum filtro ligado? Decide se "Limpar filtros" aparece. */
export function temFiltroAtivo(filters: CafeFilters): boolean {
  return (
    CHAVES.some((chave) => filters[chave]) ||
    filters.bairros.length > 0 ||
    filters.precos.length > 0 ||
    filters.q.trim() !== ""
  );
}

/**
 * Badge do botão de filtros (mobile): cada booleano ligado, cada bairro e cada
 * faixa marcados contam 1. A busca fica de fora — ela aparece no próprio campo.
 */
export function contarFiltrosAtivos(filters: CafeFilters): number {
  return (
    CHAVES.filter((chave) => filters[chave]).length + filters.bairros.length + filters.precos.length
  );
}

export type BairroOpcao = { slug: string; nome: string };

/** Opções do filtro de bairro: cada bairro dos cafés uma vez, em ordem alfabética pt-BR. */
export function bairrosDisponiveis(cafes: Cafe[]): BairroOpcao[] {
  const porSlug = new Map(cafes.map((cafe) => [cafe.bairro_slug, cafe.bairro]));
  return Array.from(porSlug, ([slug, nome]) => ({ slug, nome })).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Rótulo do chip de bairro: `Bairro` → nome do bairro → `N bairros`. */
export function bairroChipLabel(selecionados: readonly string[], bairros: BairroOpcao[]): string {
  if (selecionados.length === 0) return "Bairro";
  if (selecionados.length > 1) return `${selecionados.length} bairros`;
  return bairros.find((b) => b.slug === selecionados[0])?.nome ?? "Bairro";
}
