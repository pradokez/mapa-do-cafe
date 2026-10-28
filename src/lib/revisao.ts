/**
 * Fila de revisões da curadoria (#177, PRD #167). Puro: não importa React nem
 * Supabase. O robô propõe, a administradora decide — aqui só o que a tela de
 * leitura precisa: filtro por status, ordem, agrupamento, etiquetas e valores.
 */

import { formatarHorario, horarioDaSemana, NOME_DO_DIA } from "./cafe-hours";
import { alternarEm, statusDoParam } from "./filtro-de-status";

export const STATUS_REVISAO = ["pendente", "aprovada", "rejeitada", "obsoleta"] as const;
export type StatusRevisao = (typeof STATUS_REVISAO)[number];

export const ROTULO_STATUS_REVISAO: Record<StatusRevisao, string> = {
  pendente: "Pendentes",
  aprovada: "Aprovadas",
  rejeitada: "Rejeitadas",
  obsoleta: "Obsoletas",
};

/** Só o que espera decisão aparece até alguém pedir o resto. */
export const FILTRO_PADRAO_REVISOES: StatusRevisao[] = ["pendente"];

export type TipoRevisao = "cafe_novo" | "atualizacao" | "fechamento";
export type Atualidade = "atualizada" | "antiga" | "sem_data" | "conflito";

/** Colunas de `cafes` que uma `atualizacao` pode propor (o `check` da tabela). */
export const CAMPOS_DE_REVISAO = [
  "endereco",
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
] as const;
export type CampoDeRevisao = (typeof CAMPOS_DE_REVISAO)[number];

export const ROTULO_DO_CAMPO: Record<CampoDeRevisao, string> = {
  endereco: "Endereço",
  aceita_pets: "Aceita pets",
  tem_estacionamento: "Tem estacionamento",
  permite_coffee_office: "Permite coffee office",
  acessivel_pcd: "Acessível para PcD",
  opcoes_vegetarianas: "Opções vegetarianas",
  tem_ar_condicionado: "Ar-condicionado",
  faixa_preco: "Faixa de preço",
  horario_funcionamento: "Horário de funcionamento",
  instagram: "Instagram",
  telefone: "Telefone",
};

export type FonteDaRevisao = {
  url: string;
  titulo: string;
  /** A data como aparece na página; `null` quando não há. */
  data_fonte: string | null;
  trecho: string;
  atualidade: Atualidade;
};

/** Uma linha de `revisoes`, como o admin a lê (`listRevisoes`), com o café do join. */
export type Revisao = {
  id: string;
  tipo: TipoRevisao;
  cafe_id: string | null;
  campo: CampoDeRevisao | null;
  valor_atual: unknown;
  valor_proposto: unknown;
  fontes: FonteDaRevisao[];
  atualidade: Atualidade;
  status: StatusRevisao;
  criado_em: string;
  decidido_em: string | null;
  cafe: { nome: string; slug: string; ativo: boolean } | null;
  /** `valor_proposto.nome` do `cafe_novo`; `null` nos outros tipos. */
  nome_proposto: string | null;
};

export type ContagemDeRevisoes = Record<StatusRevisao, number>;

export type Rodada = {
  id: string;
  inicio: string;
  fim: string | null;
  cafes_verificados: number;
  revisoes_criadas: number;
  erro: string | null;
};

export function statusDoFiltro(param: string | string[] | undefined): StatusRevisao[] {
  return statusDoParam(STATUS_REVISAO, FILTRO_PADRAO_REVISOES, param);
}

/** O filtro que um chip aplica ao ser clicado (o último ligado não desliga). */
export function alternarStatus(atuais: readonly StatusRevisao[], status: StatusRevisao): StatusRevisao[] {
  return alternarEm(STATUS_REVISAO, atuais, status);
}

// O que mais engana quem usa o site vem primeiro.
const ORDEM_DO_TIPO: Record<TipoRevisao, number> = { fechamento: 0, cafe_novo: 1, atualizacao: 2 };

/** Fechamento, café novo, atualização; dentro de cada tipo, as mais recentes antes. Não muda a lista. */
export function ordenarRevisoes(revisoes: readonly Revisao[]): Revisao[] {
  return [...revisoes].sort(
    (a, b) =>
      ORDEM_DO_TIPO[a.tipo] - ORDEM_DO_TIPO[b.tipo] ||
      b.criado_em.localeCompare(a.criado_em) ||
      a.id.localeCompare(b.id),
  );
}

export type GrupoDeRevisoes = {
  chave: string;
  titulo: string;
  cafe: Revisao["cafe"];
  revisoes: Revisao[];
};

/**
 * Junta as revisões do mesmo café, na ordem em que o primeiro de cada café
 * aparece (a lista já vem ordenada). Café novo ainda não existe no banco:
 * cada proposta é um grupo.
 */
export function agruparPorCafe(revisoes: readonly Revisao[]): GrupoDeRevisoes[] {
  const grupos = new Map<string, GrupoDeRevisoes>();
  for (const revisao of revisoes) {
    const chave = revisao.cafe_id ?? revisao.id;
    const grupo = grupos.get(chave);
    if (grupo) {
      grupo.revisoes.push(revisao);
    } else {
      grupos.set(chave, {
        chave,
        titulo: revisao.cafe?.nome ?? revisao.nome_proposto ?? "Café novo",
        cafe: revisao.cafe,
        revisoes: [revisao],
      });
    }
  }
  return Array.from(grupos.values());
}

const DATA_ISO = /^(\d{4})-(\d{2})(?:-\d{2})?$/;

/** Meses desde a fonte mais recente com data ISO; `null` se nenhuma tem. O resto das datas é do `revisao-atualidade`. */
function mesesDesdeAFonte(fontes: readonly FonteDaRevisao[], agora: Date): number | null {
  const meses = fontes.flatMap((f) => {
    const m = DATA_ISO.exec(f.data_fonte ?? "");
    return m ? [Number(m[1]) * 12 + Number(m[2]) - 1] : [];
  });
  if (meses.length === 0) return null;
  return agora.getUTCFullYear() * 12 + agora.getUTCMonth() - Math.max(...meses);
}

/** A etiqueta visível da revisão: `Atualizada`, `Antiga · 2 anos`, `Sem data`, `Fontes discordam`. */
export function rotuloDeAtualidade(atualidade: Atualidade, fontes: readonly FonteDaRevisao[], agora: Date): string {
  if (atualidade === "atualizada") return "Atualizada";
  if (atualidade === "sem_data") return "Sem data";
  if (atualidade === "conflito") return "Fontes discordam";
  const meses = mesesDesdeAFonte(fontes, agora);
  if (meses === null || meses < 1) return "Antiga";
  if (meses < 12) return `Antiga · ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `Antiga · ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

const SEM_INFORMACAO = "Sem informação";

/** O valor de um campo como linhas de texto: booleano em Sim/Não, horário em sete linhas. */
export function formatarValor(campo: CampoDeRevisao, valor: unknown): string[] {
  if (typeof valor === "boolean") return [valor ? "Sim" : "Não"];
  if (campo === "horario_funcionamento" && valor !== null && typeof valor === "object") {
    return horarioDaSemana(valor).map(
      ({ dia, horario }) => `${NOME_DO_DIA[dia]}: ${horario === null ? "Não informado" : formatarHorario(horario)}`,
    );
  }
  if (typeof valor === "string" && valor.trim() !== "") return [valor];
  return [SEM_INFORMACAO];
}

/** "1 revisão pendente" / "N revisões pendentes" — o cartão do topo do `/admin`. */
export function rotuloDePendentes(n: number): string {
  return n === 1 ? "1 revisão pendente" : `${n.toLocaleString("pt-BR")} revisões pendentes`;
}

const partesDaRodada = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "27/10, 23:30", no fuso de Recife. */
export function formatarUltimaRodada(iso: string): string {
  const p = Object.fromEntries(partesDaRodada.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}, ${p.hour}:${p.minute}`;
}
