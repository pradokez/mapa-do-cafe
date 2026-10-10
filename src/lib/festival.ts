/**
 * Festivais (PRD #98) — regras puras de uma edição: quando está ativa, como
 * se descreve (status, período, preço) e onde fica. Sem React, sem Supabase.
 *
 * No ar = publicada e com `hoje <= fim` (futura ou ativa); ativa = com
 * `inicio <= hoje <= fim`. Sempre no dia de Recife (a Vercel roda em UTC). A
 * decisão acontece no render, nunca dentro de um cache.
 */

import { compararPorNome, type Cafe } from "./cafe";
import { resolveCafePhotos, urlPublicaNoBucket, type PhotoSource } from "./cafe-photos";
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
 * Combos de um café (bloco do detalhe): um por edição no ar em que ele
 * participa, na ordem de `edicoesNoAr` — inclusive antes do início, com os
 * textos de data em contagem (`prazoDoCombo`, `disponibilidadeDoCombo`).
 * Vazio para edição não publicada ou encerrada e para quem não participa.
 */
export function combosDoCafe<E extends Edicao>(
  edicoes: readonly E[],
  cafeId: string,
  agora: Date,
): { edicao: E; participacao: E["participacoes"][number] }[] {
  return edicoesNoAr(edicoes, agora).flatMap((edicao) => {
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
 * amanhã" / "· último dia", "Edição encerrada", e antes do início (a edição
 * publicada já está no ar, decisão de 10/10/2026) "Em breve · começa em 5
 * dias" / "· começa amanhã".
 */
export function rotuloDeStatus(edicao: Periodo, agora: Date): string {
  const estado = estadoDaEdicao(edicao, agora);
  if (estado === "encerrada") return "Edição encerrada";
  if (estado === "futura") return `Em breve · ${prazoDoCombo(edicao, agora)}`;
  const faltam = diasEntre(hojeEmRecife(agora), edicao.fim);
  const quando = faltam === 0 ? "último dia" : faltam === 1 ? "termina amanhã" : `termina em ${faltam} dias`;
  return `Acontecendo agora · ${quando}`;
}

/** "até 15 nov": o último dia, sem ano (a pílula do combo só aparece com a edição no ar). */
export function ateODia(edicao: Pick<Edicao, "fim">): string {
  const { dia, mes } = partes(edicao.fim);
  return `até ${dia} ${mes}`;
}

/** Dias até o início, se a edição ainda não começou (no dia de Recife). */
function diasParaComecar(edicao: Periodo, agora: Date): number | null {
  return estadoDaEdicao(edicao, agora) === "futura" ? diasEntre(hojeEmRecife(agora), edicao.inicio) : null;
}

/** Prazo da pílula do combo: "começa em 5 dias" / "começa amanhã" antes do início; depois, "até 15 nov". */
export function prazoDoCombo(edicao: Periodo, agora: Date): string {
  const faltam = diasParaComecar(edicao, agora);
  if (faltam === null) return ateODia(edicao);
  return faltam === 1 ? "começa amanhã" : `começa em ${faltam} dias`;
}

/**
 * Nota do combo: "Disponível a partir de 18 out (em 5 dias | amanhã), até 15
 * nov, …" antes do início; depois, "Disponível enquanto durar o festival, …".
 */
export function disponibilidadeDoCombo(edicao: Periodo, agora: Date): string {
  const faltam = diasParaComecar(edicao, agora);
  if (faltam === null) return "Disponível enquanto durar o festival, no horário normal da casa.";
  const { dia, mes } = partes(edicao.inicio);
  const quando = faltam === 1 ? "amanhã" : `em ${faltam} dias`;
  return `Disponível a partir de ${dia} ${mes} (${quando}), ${ateODia(edicao)}, no horário normal da casa.`;
}

/** "começa em 18 out": o primeiro dia, sem ano (a etiqueta da edição futura no admin). */
export function comecaEm(edicao: Pick<Edicao, "inicio">): string {
  const { dia, mes } = partes(edicao.inicio);
  return `começa em ${dia} ${mes}`;
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

/**
 * A edição tem página (e entra no sitemap): publicada e com pelo menos um
 * participante — sem nenhum, a página seria uma faixa sobre uma grade vazia.
 */
export function edicaoTemPagina(edicao: Pick<Edicao, "publicada" | "participacoes">): boolean {
  return edicao.publicada && edicao.participacoes.length > 0;
}

/**
 * A edição da página `/festivais/{festival}/{ano}`, com o estado de hoje, ou
 * `null` (→ 404) se ela não tem página (`edicaoTemPagina`). Com página, abre
 * em qualquer estado: futura (já está no ar, decisão de 10/10/2026), ativa ou
 * encerrada. `noAr` é a edição do mesmo festival no ar hoje, também com
 * página, para o "Ver edição {ano}" da encerrada.
 */
export function edicaoDaPagina<E extends Edicao>(
  edicoes: readonly E[],
  festival: string,
  ano: string,
  agora: Date,
): { edicao: E; estado: EstadoEdicao; noAr: E | null } | null {
  const doFestival = edicoes.filter((e) => edicaoTemPagina(e) && e.festival.slug === festival);
  const edicao = doFestival.find((e) => String(e.ano) === ano);
  if (!edicao) return null;
  const [noAr = null] = edicoesNoAr(doFestival, agora);
  return { edicao, estado: estadoDaEdicao(edicao, agora), noAr };
}

/**
 * Edições com vitrine na home (#106): as no ar — inclusive antes do início,
 * como chip, selo e bloco do combo — e com página, para onde vai o "Ver
 * todos". Na ordem de `edicoesNoAr`: com duas, a que termina primeiro em cima.
 */
export function edicoesEmVitrine<E extends Edicao>(edicoes: readonly E[], agora: Date): E[] {
  return edicoesNoAr(edicoes, agora).filter(edicaoTemPagina);
}

/**
 * Linha da vitrine: "12 cafés participando · até 15 nov · R$ 34,90"; antes do
 * início, "· começa em 8 dias ·" (`prazoDoCombo`).
 */
export function resumoDaVitrine(
  edicao: Pick<Edicao, "inicio" | "fim" | "preco">,
  participantes: number,
  agora: Date,
): string {
  return [
    participantes === 1 ? "1 café participando" : `${participantes} cafés participando`,
    prazoDoCombo(edicao, agora),
    edicao.preco !== null && formatarPreco(edicao.preco),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Um combo da página: a participação e o café dela. */
export interface Combo {
  participacao: Participacao;
  cafe: Cafe;
}

/**
 * Os combos da edição na ordem da divulgação (`ordenarPorNumero`). A RLS já
 * tira os cafés fora do ar; a participação sem café na lista também sai.
 */
export function combosDaEdicao(edicao: Pick<Edicao, "participacoes">, cafes: readonly Cafe[]): Combo[] {
  const porId = new Map(cafes.map((cafe) => [cafe.id, cafe]));
  return ordenarPorNumero(edicao.participacoes).flatMap((participacao) => {
    const cafe = porId.get(participacao.cafe_id);
    return cafe ? [{ participacao, cafe }] : [];
  });
}

export interface BairroDoFestival {
  slug: string;
  nome: string;
}

/** Opções do filtro da página: os bairros dos participantes, sem repetir, em ordem alfabética. */
export function bairrosDosCombos(combos: readonly Combo[]): BairroDoFestival[] {
  const porSlug = new Map(combos.map(({ cafe }) => [cafe.bairro_slug, cafe.bairro]));
  return Array.from(porSlug, ([slug, nome]) => ({ slug, nome }))
    .sort((a, b) => compararPorNome(a, b));
}

/** `?bairro=` da página (escolha única): só um bairro dos participantes; o resto é ignorado. */
export function bairroDoParam(
  param: string | null | undefined,
  bairros: readonly BairroDoFestival[],
): string | null {
  return param && bairros.some(({ slug }) => slug === param) ? param : null;
}

/** Contador da grade: "1 combo" / "N combos". */
export function rotuloDeCombos(n: number): string {
  return n === 1 ? "1 combo" : `${n} combos`;
}

/** Faixa da página: "1 café participante" / "N cafés participantes". */
export function rotuloDeParticipantes(n: number): string {
  return n === 1 ? "1 café participante" : `${n} cafés participantes`;
}

/**
 * A imagem de um combo: a arte, ou, enquanto ela não chega (o café participa
 * sem arte), o placeholder listrado do café — o mesmo do card dele.
 */
export function fonteDaArte({ participacao, cafe }: Combo): PhotoSource {
  if (participacao.arte) return { kind: "url", src: participacao.arte };
  return resolveCafePhotos({ id: cafe.id, fotos: [] })[0];
}
