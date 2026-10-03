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
  selo_ascape: boolean;
  /** Participante do festival Eu Amo Café (6ª edição, 2026). */
  selo_eu_amo_cafe: boolean;
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
  /** Vazio na Fase 1; URLs do Supabase Storage na Fase 2. */
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
  "selo_ascape",
  "selo_eu_amo_cafe",
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

/** Ordem alfabética pt-BR, ignorando caixa e acento ("Café com" antes de "Café Jardim"). */
export function compararPorNome(a: Pick<Cafe, "nome">, b: Pick<Cafe, "nome">): number {
  return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}
