/**
 * Atualidade das fontes de uma revisão (#178, PRD #167) — sem React, sem
 * Supabase, sem relógio: o modelo extrai e o código decide. Uma fonte é
 * `atualizada` (data nos últimos 6 meses), `antiga` (data fora da janela) ou
 * `sem_data`; a revisão herda a da fonte datada mais recente, ou vira
 * `conflito` quando as fontes discordam.
 */

import { hojeEmRecife } from "./foto-upload";
import { normalizarTrecho } from "./revisao-fontes";
import type { Atualidade, FonteDaRevisao } from "./revisao";
import { chaveDoValor, type CampoRevisado, type FonteDaProposta } from "./revisao-proposta";

/** Janela única, para todo campo: a fonte vale se tem até tantos meses. */
export const JANELA_EM_MESES = 6;
/** Fontes datadas que discordam com menos de tantos dias entre si são `conflito`. */
export const DIAS_DE_CONFLITO = 30;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

const MESES = [
  ["janeiro", "jan"],
  ["fevereiro", "fev"],
  ["marco", "mar"],
  ["abril", "abr"],
  ["maio", "mai"],
  ["junho", "jun"],
  ["julho", "jul"],
  ["agosto", "ago"],
  ["setembro", "set"],
  ["outubro", "out"],
  ["novembro", "nov"],
  ["dezembro", "dez"],
];

const NOME_DO_MES = MESES.flat().join("|");

/** Ano, mês (1–12) e dia; `dia` é `null` quando a data só diz o mês. */
type Data = { ano: number; mes: number; dia: number | null };

// Da mais específica para a mais curta, e sempre inteira: "12/03/2026" não
// pode virar "03/2026" por baixo. Texto já normalizado (sem acento, minúsculo).
const FORMATOS: { re: string; ler: (m: RegExpMatchArray) => Data | null }[] = [
  // 2026-03-12 · 2026-03
  { re: String.raw`(\d{4})-(\d{1,2})(?:-(\d{1,2}))?`, ler: (m) => data(+m[1], +m[2], m[3] ? +m[3] : null) },
  // 12/03/2026 · 12.03.2026 · 12-03-2026
  { re: String.raw`(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})`, ler: (m) => data(+m[3], +m[2], +m[1]) },
  // 12 de março de 2026 · 12 mar 2026 · 12 mar. 2026
  {
    re: String.raw`(\d{1,2})(?:o|º)?\s*(?:de\s+)?(${NOME_DO_MES})\.?\s*(?:de\s+|,\s*)?(\d{4})`,
    ler: (m) => data(+m[3], mesDoNome(m[2]), +m[1]),
  },
  // março de 2026 · mar 2026 · mar/2026
  {
    re: String.raw`(?<!\p{L})(${NOME_DO_MES})\.?\s*(?:de\s+|[/,]\s*)?(\d{4})`,
    ler: (m) => data(+m[2], mesDoNome(m[1]), null),
  },
  // 03/2026
  { re: String.raw`(\d{1,2})/(\d{4})`, ler: (m) => data(+m[2], +m[1], null) },
];

function mesDoNome(nome: string): number {
  return MESES.findIndex((nomes) => nomes.includes(nome)) + 1;
}

function data(ano: number, mes: number, dia: number | null): Data | null {
  if (mes < 1 || mes > 12) return null;
  if (dia !== null) {
    const naData = new Date(Date.UTC(ano, mes - 1, dia));
    if (naData.getUTCMonth() !== mes - 1) return null; // 31/02 viraria março
  }
  return { ano, mes, dia };
}

/** Todas as datas escritas no texto, em qualquer formato aceito (sem repetir o mesmo pedaço). */
function datasDoTexto(texto: string): Data[] {
  let resto = normalizarTrecho(texto);
  const achadas: Data[] = [];
  for (const { re, ler } of FORMATOS) {
    // Nunca pedaço de número maior: "3071-6834" e "12/09/20266" não são datas.
    const regex = new RegExp(String.raw`(?<![\d/])${re}(?![\d/])`, "gu");
    for (const m of Array.from(resto.matchAll(regex))) {
      const lida = ler(m);
      if (lida) achadas.push(lida);
    }
    resto = resto.replace(regex, " ");
  }
  return achadas;
}

/** A data de `data_fonte`, só se for uma única data escrita por inteiro (relativa e vazia não são). */
function lerDataDaFonte(texto: string | null): Data | null {
  if (texto === null) return null;
  const todas = datasDoTexto(texto);
  return todas.length === 1 ? todas[0] : null;
}

/** O trecho sustenta a data da fonte? Dia citado precisa estar no trecho; só mês aceita qualquer dia dele. */
const sustenta = (daFonte: Data, noTrecho: Data) =>
  daFonte.ano === noTrecho.ano && daFonte.mes === noTrecho.mes && (daFonte.dia === null || daFonte.dia === noTrecho.dia);

/** Dia corrido (UTC) de uma data; só mês vale o dia 1, o lado de quem exige a fonte recente. */
function diaCorrido({ ano, mes, dia }: Data): number {
  return Math.floor(Date.UTC(ano, mes - 1, dia ?? 1) / DIA_EM_MS);
}

/** Hoje (dia de `America/Recife`) e o limite da janela: o mesmo dia, `JANELA_EM_MESES` meses antes. */
function hojeELimite(agora: Date): { hoje: Data; mesAtual: number; limite: number } {
  const [ano, mes, dia] = hojeEmRecife(agora).split("-").map(Number);
  const hoje = { ano, mes, dia };
  const alvo = new Date(Date.UTC(ano, mes - 1 - JANELA_EM_MESES, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const limite = diaCorrido({ ano: alvo.getUTCFullYear(), mes: alvo.getUTCMonth() + 1, dia: Math.min(dia, ultimoDia) });
  return { hoje, mesAtual: ano * 12 + mes, limite };
}

type FonteClassificada = { fonte: FonteDaProposta; atualidade: Atualidade; dia: number | null };

function classificar(fonte: FonteDaProposta, agora: Date): FonteClassificada {
  const semData = { fonte, atualidade: "sem_data" as const, dia: null };
  const escrita = lerDataDaFonte(fonte.data_fonte);
  if (!escrita) return semData;
  // A data precisa estar no trecho citado, em qualquer formato.
  if (!datasDoTexto(fonte.trecho).some((noTrecho) => sustenta(escrita, noTrecho))) return semData;

  const { hoje, mesAtual, limite } = hojeELimite(agora);
  const futura = escrita.dia === null ? escrita.ano * 12 + escrita.mes > mesAtual : diaCorrido(escrita) > diaCorrido(hoje);
  if (futura) return semData;

  const dia = diaCorrido(escrita);
  return { fonte, atualidade: dia >= limite ? "atualizada" : "antiga", dia };
}

/**
 * A fonte tem data que o próprio trecho sustenta (#213)? O robô só propõe com
 * fonte datada: sem data, a administradora não tem como pesar a informação.
 */
export function fonteDatada(fonte: Pick<FonteDaProposta, "url" | "titulo" | "data_fonte" | "trecho">, agora: Date): boolean {
  return classificar({ ...fonte, valor: null }, agora).atualidade !== "sem_data";
}

export type ResultadoDeAtualidade = {
  /** As mesmas fontes, na mesma ordem, cada uma com a sua atualidade. */
  fontes: (FonteDaProposta & Pick<FonteDaRevisao, "atualidade">)[];
  atualidade: Atualidade;
};

/**
 * Classifica cada fonte e a revisão. A revisão herda a atualidade da fonte
 * datada mais recente; é `conflito` quando fontes datadas com valores
 * diferentes ficam a menos de 30 dias uma da outra, ou quando nenhuma tem data
 * e elas discordam. Sem fonte, `sem_data`.
 *
 * A janela é a mesma para todo campo; o `campo` decide só o que é discordar
 * (`chaveDoValor`: no endereço, o mesmo lugar em outro formato concorda, #190).
 */
export function atualidadeDasFontes(
  fontes: readonly FonteDaProposta[],
  campo: CampoRevisado | null,
  agora: Date,
): ResultadoDeAtualidade {
  const classificadas = fontes.map((fonte) => classificar(fonte, agora));
  const resultado = classificadas.map(({ fonte, atualidade }) => ({ ...fonte, atualidade }));

  const datadas = classificadas.filter((c) => c.dia !== null);
  const discordam = (a: FonteClassificada, b: FonteClassificada) => chaveDoValor(campo, a.fonte.valor) !== chaveDoValor(campo, b.fonte.valor);

  const emConflito =
    datadas.length === 0
      ? classificadas.some((c) => discordam(c, classificadas[0]))
      : datadas.some((a, i) =>
          datadas.slice(i + 1).some((b) => discordam(a, b) && Math.abs(a.dia! - b.dia!) < DIAS_DE_CONFLITO),
        );
  if (emConflito) return { fontes: resultado, atualidade: "conflito" };

  if (datadas.length === 0) return { fontes: resultado, atualidade: "sem_data" };
  const maisRecente = datadas.reduce((a, b) => (b.dia! > a.dia! ? b : a));
  return { fontes: resultado, atualidade: maisRecente.atualidade };
}
