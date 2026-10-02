// Formato do registro de café — espelha a tabela `cafes` e supabase/seed/cafes.json.

export type FaixaPreco = "$" | "$$" | "$$$";

export type Cidade = "Recife" | "Olinda";

export type DiaSemana =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export type Comodidade =
  | "24-horas"
  | "acessivel"
  | "area-externa"
  | "brunch"
  | "cursos"
  | "delivery"
  | "jardim"
  | "kids"
  | "livraria"
  | "loja"
  | "manobrista"
  | "musica-ao-vivo"
  | "opcoes-veganas"
  | "reservas"
  | "torrefacao"
  | "wifi";

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
  aceita_pets: boolean;
  tem_estacionamento: boolean;
  permite_coffee_office: boolean;
  faixa_preco: FaixaPreco;
  comodidades: Comodidade[];
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
