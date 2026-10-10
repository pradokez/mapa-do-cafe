/**
 * Festivais (PRD #98) — regras puras de uma edição: quando está ativa, como
 * se descreve (status, período, preço) e onde fica. Sem React, sem Supabase.
 *
 * No ar = publicada e com `hoje <= fim` (futura ou ativa); ativa = com
 * `inicio <= hoje <= fim`. Sempre no dia de Recife (a Vercel roda em UTC). A
 * decisão acontece no render, nunca dentro de um cache.
 */

import { urlPublicaNoBucket } from "./cafe-photos";
import { hojeEmRecife } from "./foto-upload";

export type FestivalSlug = "recife-coffee" | "eu-amo-cafe";

/** Um café na edição. Sem número, sem combo e sem arte até a administradora preencher. */
export interface Participacao {
  id: string;
  cafe_id: string;
  /** Número do combo no festival; único na edição quando preenchido. */
  numero: number | null;
  nome_combo: string | null;
  /** Transcrição da arte (o texto do combo está dentro da imagem). */
  alt: string | null;
  instagram_url: string | null;
  /** URL pública da arte no bucket `festival-artes`. */
  arte: string | null;
}

export interface Edicao {
  id: string;
  festival: { slug: FestivalSlug; nome: string };
  ano: number;
  /** `AAAA-MM-DD`. */
  inicio: string;
  /** `AAAA-MM-DD`, inclusive. */
  fim: string;
  descricao: string | null;
  /** Preço único do combo, em centavos. */
  preco: number | null;
  publicada: boolean;
  participacoes: Participacao[];
}

export type EstadoEdicao = "futura" | "ativa" | "encerrada";

type Periodo = Pick<Edicao, "inicio" | "fim">;

/** Estado pelas datas, no dia de Recife. Não olha `publicada`. */
export function estadoDaEdicao(edicao: Periodo, agora: Date): EstadoEdicao {
  const hoje = hojeEmRecife(agora);
  if (hoje < edicao.inicio) return "futura";
  if (hoje > edicao.fim) return "encerrada";
  return "ativa";
}

/**
 * Edições no ar hoje: publicadas e ainda não encerradas — já começaram ou vão
 * começar (a administradora publica antes, e o site mostra "começa em N
 * dias"). Uma por festival, a que termina primeiro antes (é a ordem das
 * vitrines empilhadas).
 */
export function edicoesNoAr<E extends Edicao>(edicoes: readonly E[], agora: Date): E[] {
  const noAr = edicoes
    .filter((e) => e.publicada && estadoDaEdicao(e, agora) !== "encerrada")
    .sort((a, b) => a.fim.localeCompare(b.fim));
  return noAr.filter((e, i) => noAr.findIndex((o) => o.festival.slug === e.festival.slug) === i);
}

/**
 * Ids dos cafés participantes de cada festival no ar — o que chip, selo e
 * filtro precisam. Festival fora do ar não tem chave. Dado simples, para
 * atravessar a fronteira Server → Client Component.
 */
export type FestivaisNoAr = Partial<Record<FestivalSlug, string[]>>;

export function participantesNoAr(edicoes: readonly Edicao[], agora: Date): FestivaisNoAr {
  return Object.fromEntries(
    edicoesNoAr(edicoes, agora).map((e) => [e.festival.slug, e.participacoes.map((p) => p.cafe_id)]),
  );
}

/**
 * Combos de um café nas edições já começadas (bloco do detalhe): um por
 * edição ativa em que ele participa, na ordem de `edicoesNoAr`. Vazio antes
 * do início (o bloco ainda não tem o "começa em N dias"), fora da edição ou
 * para quem não participa.
 */
export function combosDoCafe<E extends Edicao>(
  edicoes: readonly E[],
  cafeId: string,
  agora: Date,
): { edicao: E; participacao: E["participacoes"][number] }[] {
  const ativas = edicoesNoAr(edicoes, agora).filter((e) => estadoDaEdicao(e, agora) === "ativa");
  return ativas.flatMap((edicao) => {
    const participacao = edicao.participacoes.find((p) => p.cafe_id === cafeId);
    return participacao ? [{ edicao, participacao }] : [];
  });
}

/** "Combo 13"; sem número ainda, "Combo do Eu Amo Café". */
export function tituloDoCombo(
  edicao: Pick<Edicao, "festival">,
  participacao: Pick<Participacao, "numero">,
): string {
  return participacao.numero === null ? `Combo do ${edicao.festival.nome}` : `Combo ${participacao.numero}`;
}

/** Dias inteiros de `de` até `ate` (`AAAA-MM-DD`). */
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function partes(data: string): { dia: number; mes: string; ano: string } {
  const [ano, mes, dia] = data.split("-");
  return { dia: Number(dia), mes: MESES[Number(mes) - 1], ano };
}

/**
 * Faixa de status: "Acontecendo agora · termina em 10 dias" / "· termina
 * amanhã" / "· último dia", "Edição encerrada", ou "Começa em 18 out".
 */
export function rotuloDeStatus(edicao: Periodo, agora: Date): string {
  const estado = estadoDaEdicao(edicao, agora);
  if (estado === "encerrada") return "Edição encerrada";
  if (estado === "futura") {
    const { dia, mes } = partes(edicao.inicio);
    return `Começa em ${dia} ${mes}`;
  }
  const faltam = diasEntre(hojeEmRecife(agora), edicao.fim);
  const quando = faltam === 0 ? "último dia" : faltam === 1 ? "termina amanhã" : `termina em ${faltam} dias`;
  return `Acontecendo agora · ${quando}`;
}

/** "até 15 nov": o último dia, sem ano (a pílula do combo só aparece com a edição no ar). */
export function ateODia(edicao: Pick<Edicao, "fim">): string {
  const { dia, mes } = partes(edicao.fim);
  return `até ${dia} ${mes}`;
}

/** "18 out a 15 nov 2026", "3 a 28 mai 2026", "28 dez 2026 a 5 jan 2027", "18 out 2026". */
export function periodoDaEdicao(edicao: Periodo): string {
  const i = partes(edicao.inicio);
  const f = partes(edicao.fim);
  const fim = `${f.dia} ${f.mes} ${f.ano}`;
  if (edicao.inicio === edicao.fim) return fim;
  if (i.ano !== f.ano) return `${i.dia} ${i.mes} ${i.ano} a ${fim}`;
  if (i.mes !== f.mes) return `${i.dia} ${i.mes} a ${fim}`;
  return `${i.dia} a ${fim}`;
}

const reais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos → "R$ 34,90" (espaço comum, não o NBSP do estilo `currency`). */
export function formatarPreco(centavos: number): string {
  return `R$ ${reais.format(centavos / 100)}`;
}

/** Ordem da divulgação: número crescente; sem número no fim, na ordem recebida. */
export function ordenarPorNumero<P extends Pick<Participacao, "numero">>(participacoes: readonly P[]): P[] {
  return [...participacoes].sort((a, b) => {
    if (a.numero === b.numero) return 0;
    if (a.numero === null) return 1;
    if (b.numero === null) return -1;
    return a.numero - b.numero;
  });
}

/** Página da edição: `/festivais/eu-amo-cafe/2026`. */
export function urlDaEdicao(edicao: Pick<Edicao, "festival" | "ano">): string {
  return `/festivais/${edicao.festival.slug}/${edicao.ano}`;
}

/** Bucket público das artes — o mesmo da migration dos festivais. */
export const BUCKET_ARTES = "festival-artes";

/** Caminho no bucket (`{edicao_id}/{uuid}.webp`) → URL pública. O banco não sabe o endereço do projeto. */
export function urlPublicaDaArte(caminho: string, supabaseUrl: string): string {
  return urlPublicaNoBucket(supabaseUrl, BUCKET_ARTES, caminho);
}
