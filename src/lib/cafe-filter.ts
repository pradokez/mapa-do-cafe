import type { Cafe, FaixaPreco } from "./cafe";
import type { FestivaisNoAr, FestivalSlug } from "./festival";

/**
 * Filtros de festival: chave do estado → festival e param da URL. Passa quem
 * participa da edição no ar; com o festival fora do ar, o filtro não existe
 * (o param é ignorado e não volta na serialização).
 */
const FILTROS_DE_FESTIVAL = {
  recifeCoffee: { festival: "recife-coffee", param: "recife_coffee" },
  euAmoCafe: { festival: "eu-amo-cafe", param: "eu_amo_cafe" },
} as const satisfies Record<string, { festival: FestivalSlug; param: string }>;

/** Filtros de atributo: chave do estado → campo do café e param da URL (`?pets=true`). */
const FILTROS_DE_ATRIBUTO = {
  pets: { campo: "aceita_pets", param: "pets" },
  estacionamento: { campo: "tem_estacionamento", param: "estacionamento" },
  coffeeOffice: { campo: "permite_coffee_office", param: "coffee_office" },
  pcd: { campo: "acessivel_pcd", param: "pcd" },
  vegetariano: { campo: "opcoes_vegetarianas", param: "vegetariano" },
  // `null` (sem informação) não passa: só `true` conta.
  arCondicionado: { campo: "tem_ar_condicionado", param: "ar_condicionado" },
} as const satisfies Record<string, { campo: keyof Cafe; param: string }>;

type FiltroDeFestival = keyof typeof FILTROS_DE_FESTIVAL;
type FiltroDeAtributo = keyof typeof FILTROS_DE_ATRIBUTO;
export type FiltroBooleano = FiltroDeFestival | FiltroDeAtributo;

/** Params que já foram de filtro: ignorados na leitura e apagados na escrita. */
const PARAMS_ANTIGOS = ["ascape"];

export type CafeFilters = Record<FiltroBooleano, boolean> & {
  /** Slugs de bairro aceitos (união); vazio = filtro desligado. */
  bairros: string[];
  /** Faixas aceitas (união); vazio = filtro desligado. */
  precos: FaixaPreco[];
  /** Busca livre por nome ou bairro; vazio = filtro desligado. */
  q: string;
};

export const FILTROS_VAZIOS: CafeFilters = {
  recifeCoffee: false,
  euAmoCafe: false,
  pets: false,
  estacionamento: false,
  coffeeOffice: false,
  pcd: false,
  vegetariano: false,
  arCondicionado: false,
  bairros: [],
  precos: [],
  q: "",
};

const FESTIVAIS = Object.keys(FILTROS_DE_FESTIVAL) as FiltroDeFestival[];
const ATRIBUTOS = Object.keys(FILTROS_DE_ATRIBUTO) as FiltroDeAtributo[];
const CHAVES: FiltroBooleano[] = [...FESTIVAIS, ...ATRIBUTOS];
const PARAM = Object.fromEntries(
  Object.entries({ ...FILTROS_DE_FESTIVAL, ...FILTROS_DE_ATRIBUTO }).map(([chave, { param }]) => [chave, param]),
) as Record<FiltroBooleano, string>;

/** Ordem canônica das faixas, na URL e no estado. */
export const FAIXAS: readonly FaixaPreco[] = ["$", "$$", "$$$"];

/** Lista vazia aceita qualquer valor; senão, o valor precisa estar nela. */
const aceita = <T>(lista: readonly T[], valor: T) => lista.length === 0 || lista.includes(valor);

/**
 * Interseção dos filtros ligados — dentro de bairro e de preço, a união das
 * opções marcadas; na busca, cada palavra precisa casar com o nome ou o
 * bairro; num festival, os participantes da edição no ar (`festivais`). Filtro
 * desligado, ou de festival fora do ar, não exclui ninguém. Preserva a ordem.
 */
export function filtrarCafes(cafes: Cafe[], filters: CafeFilters, festivais: FestivaisNoAr = {}): Cafe[] {
  const atributos = ATRIBUTOS.filter((chave) => filters[chave]);
  const participantes = FESTIVAIS.filter((chave) => filters[chave])
    .map((chave) => festivais[FILTROS_DE_FESTIVAL[chave].festival])
    .filter((ids) => ids !== undefined);
  const palavras = normalizar(filters.q).split(/\s+/).filter(Boolean);
  return cafes.filter(
    (cafe) =>
      atributos.every((chave) => cafe[FILTROS_DE_ATRIBUTO[chave].campo]) &&
      participantes.every((ids) => ids.includes(cafe.id)) &&
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

type ContextoDaLeitura = {
  /** Slugs de bairro aceitos; sem a lista, qualquer slug passa. */
  bairros?: readonly string[];
  /** Festivais no ar; o param de festival fora do ar é ignorado. */
  festivais?: FestivaisNoAr;
};

/**
 * Lê o estado da URL; o que não reconhece, ignora em silêncio. Com
 * `bairros`, slug que não é de nenhum café some (link antigo de bairro que
 * saiu do diretório vira filtro desligado, não lista vazia); o mesmo com o
 * festival que não está no ar (`?eu_amo_cafe=true` de uma edição encerrada).
 */
export function parseFilters(params: ParamsLike, { bairros, festivais = {} }: ContextoDaLeitura = {}): CafeFilters {
  const filters = { ...FILTROS_VAZIOS };
  for (const chave of CHAVES) {
    filters[chave] = params.get(PARAM[chave]) === "true";
  }
  for (const chave of FESTIVAIS) {
    filters[chave] &&= festivais[FILTROS_DE_FESTIVAL[chave].festival] !== undefined;
  }
  const precos = lista(params.get("preco"));
  filters.precos = FAIXAS.filter((faixa) => precos.includes(faixa));
  filters.bairros = Array.from(new Set(lista(params.get("bairro"))))
    .filter((slug) => !bairros || bairros.includes(slug))
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
    if (filters[chave]) params.set(PARAM[chave], "true");
    else params.delete(PARAM[chave]);
  }
  for (const param of PARAMS_ANTIGOS) params.delete(param);
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

/** Tira o valor se está na lista, põe se não está. A ordem canônica é do `serializeFilters`. */
export function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
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
