// Formato do registro de café — espelha a tabela `cafes` e supabase/seed/cafes.json.

export type FaixaPreco = "$" | "$$" | "$$$";

export type Cidade = "Recife" | "Olinda" | "Jaboatão dos Guararapes";

export type DiaSemana =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export interface Cafe {
  id: string;
  slug: string;
  nome: string;
  /** Exibição, ex.: "Graças". */
  bairro: string;
  /** Filtro, ex.: "gracas". */
  bairro_slug: string;
  endereco: string;
  cidade: Cidade;
  lat: number;
  lng: number;
  aceita_pets: boolean;
  tem_estacionamento: boolean;
  permite_coffee_office: boolean;
  acessivel_pcd: boolean;
  opcoes_vegetarianas: boolean;
  /** `null` = sem informação: não conta como "tem". */
  tem_ar_condicionado: boolean | null;
  faixa_preco: FaixaPreco;
  /** "HH:MM – HH:MM", turnos separados por ", ", ou "Fechado". */
  horario_funcionamento: Record<DiaSemana, string>;
  /** URL completa. */
  instagram: string | null;
  /** Ex.: "(81) 99455-7497". */
  telefone: string | null;
  /** URLs públicas do Storage, na ordem (a primeira é a capa). No banco é cópia derivada de `cafe_fotos`, com caminhos no bucket — o `cafe-repository` os transforma em URL. */
  fotos: string[];
  ativo: boolean;
}

/** Colunas da tabela `cafes` que formam um `Cafe` (sem `location` e timestamps). */
export const CAFE_COLUMNS = [
  "id",
  "slug",
  "nome",
  "bairro",
  "bairro_slug",
  "endereco",
  "cidade",
  "lat",
  "lng",
  "aceita_pets",
  "tem_estacionamento",
  "permite_coffee_office",
  "acessivel_pcd",
  "opcoes_vegetarianas",
  "tem_ar_condicionado",
  "faixa_preco",
  "horario_funcionamento",
  "instagram",
  "telefone",
  "fotos",
  "ativo",
] as const satisfies ReadonlyArray<keyof Cafe>;

// Falha de compilação se um campo de `Cafe` ficar fora de CAFE_COLUMNS.
type MissingColumns = Exclude<keyof Cafe, (typeof CAFE_COLUMNS)[number]>;
const _allColumns: [MissingColumns] extends [never] ? true : MissingColumns = true;
void _allColumns;

/** Caminho do detalhe: `/cafes/{slug}` — links, canonical, sitemap e JSON-LD. */
export function caminhoDoCafe(cafe: Pick<Cafe, "slug">): string {
  return `/cafes/${cafe.slug}`;
}

/** Ordem alfabética pt-BR, ignorando caixa e acento ("Café com" antes de "Café Jardim"). */
export function compararPorNome(a: Pick<Cafe, "nome">, b: Pick<Cafe, "nome">): number {
  return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}
