/**
 * Fila de revisões da curadoria (#177, PRD #167). Puro: não importa React nem
 * Supabase. O robô propõe, a administradora decide — aqui só o que a tela de
 * leitura precisa: filtro por status, ordem, agrupamento, etiquetas e valores.
 */

import type { DiaSemana } from "./cafe";
import {
  BOOLEANOS,
  CIDADES,
  FAIXAS,
  MAX_TEXTO,
  normalizarInstagram,
  normalizarTelefone,
  textoAparado,
  validarHorarioDia,
  type DadosCafe,
} from "./cafe-dados";
import { DIAS_DA_SEMANA, formatarHorario, horarioDaSemana, isRegistro, NOME_DO_DIA } from "./cafe-hours";
import { alternarEm, statusDoParam } from "./filtro-de-status";
import { canonico, type Sinal } from "./revisao-proposta";
import { milhar } from "./sugestao";

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

/**
 * Resposta das actions de decisão (#182), no formato do `useFormState`. O erro
 * leva o `id` quando ele é válido: a fila mostra a mensagem no item certo, inclusive sem JS.
 */
export type DecisaoDeRevisao =
  | { ok: true; id: string; status: StatusRevisao }
  | { ok: false; erro: string; id?: string }
  | null;

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

/** "8 meses", "2 anos": a idade da fonte mais recente com data ISO, ou `null`. */
function idadeDaFonte(fontes: readonly FonteDaRevisao[], agora: Date): string | null {
  const meses = mesesDesdeAFonte(fontes, agora);
  if (meses === null || meses < 1) return null;
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

/** A etiqueta visível da revisão: `Atualizada`, `Antiga · 2 anos`, `Sem data`, `Fontes discordam`. */
export function rotuloDeAtualidade(atualidade: Atualidade, fontes: readonly FonteDaRevisao[], agora: Date): string {
  if (atualidade === "atualizada") return "Atualizada";
  if (atualidade === "sem_data") return "Sem data";
  if (atualidade === "conflito") return "Fontes discordam";
  const idade = idadeDaFonte(fontes, agora);
  return idade ? `Antiga · ${idade}` : "Antiga";
}

/**
 * Por que aprovar esta revisão pede confirmação (#182), ou `null` quando ela é
 * `atualizada` e se aprova num clique. É o texto do aviso antes do "Aprovar
 * mesmo assim"; quem confere a confirmação é o servidor.
 */
export function avisoDeConfirmacao(revisao: Pick<Revisao, "tipo" | "atualidade" | "fontes">, agora: Date): string | null {
  // Café novo: aprovar só abre o cadastro (#187), que mostra as fontes e não grava nada sozinho.
  if (revisao.tipo === "cafe_novo" || revisao.atualidade === "atualizada") return null;
  if (revisao.atualidade === "sem_data") return "As fontes não têm data.";
  if (revisao.atualidade === "conflito") return "As fontes discordam entre si.";
  const idade = idadeDaFonte(revisao.fontes, agora);
  return idade ? `A fonte mais recente tem ${idade}.` : "A fonte mais recente é antiga.";
}

export type AcoesDaRevisao = {
  aprovar: boolean;
  /** O que tira a revisão da fila (vai a `rejeitada`); `null` quando já foi decidida. */
  descartar: "Rejeitar" | "Arquivar" | null;
  /** Só no indício: não há o que aprovar, mas o café merece uma olhada. */
  verCafe: boolean;
  /** Atualização com campo: abre o café com o valor proposto no formulário (#186). */
  editar: boolean;
};

/**
 * Os botões de uma revisão (#182). Decidida não tem nenhum. "Fechado
 * temporariamente" (atualização sem campo) é só indício: Ver café e Arquivar.
 * Café novo se aprova pelo cadastro (#187): Aprovar abre o formulário preenchido.
 */
export function acoesDaRevisao(revisao: Pick<Revisao, "tipo" | "campo" | "status">): AcoesDaRevisao {
  if (revisao.status !== "pendente") return { aprovar: false, descartar: null, verCafe: false, editar: false };
  if (revisao.tipo === "atualizacao" && revisao.campo === null) {
    return { aprovar: false, descartar: "Arquivar", verCafe: true, editar: false };
  }
  return { aprovar: true, descartar: "Rejeitar", verCafe: false, editar: revisao.tipo === "atualizacao" };
}

/** O que o cadastro recebe pronto: nunca slug nem coordenadas, conferidos à mão. */
export type PreenchimentoDoCadastro = Partial<
  Omit<DadosCafe, "lat" | "lng" | "bairro_slug" | "horario_funcionamento"> & {
    horario_funcionamento: Partial<Record<DiaSemana, string>>;
  }
>;

const ehBooleano = (valor: unknown): valor is boolean => typeof valor === "boolean";
const ehUm = <T extends string>(lista: readonly T[], valor: unknown): valor is T => lista.includes(valor as T);

/**
 * `valor_proposto` de um `cafe_novo` → o que pré-preenche o cadastro (#187) e
 * os sinais de café especial. Campo a campo: o que sai do formato (cidade fora
 * das três, dia de horário inválido, Instagram de outro site) fica de fora, e
 * o formulário mantém o padrão dele. Quem valida o café inteiro é o cadastro.
 */
export function cadastroDaRevisao(valor: unknown): { campos: PreenchimentoDoCadastro; sinais: Sinal[] } {
  if (!isRegistro(valor)) return { campos: {}, sinais: [] };
  const campos: PreenchimentoDoCadastro = {};

  for (const campo of Object.keys(MAX_TEXTO) as (keyof typeof MAX_TEXTO)[]) {
    const texto = textoAparado(valor[campo]);
    if (texto) campos[campo] = texto;
  }
  if (ehUm(CIDADES, valor.cidade)) campos.cidade = valor.cidade;
  if (ehUm(FAIXAS, valor.faixa_preco)) campos.faixa_preco = valor.faixa_preco;
  for (const campo of BOOLEANOS) if (ehBooleano(valor[campo])) campos[campo] = valor[campo];
  const ar = valor.tem_ar_condicionado;
  if (ar === null || ehBooleano(ar)) campos.tem_ar_condicionado = ar;

  const instagram = normalizarInstagram(valor.instagram);
  if (instagram.ok && instagram.valor) campos.instagram = instagram.valor;
  const telefone = normalizarTelefone(valor.telefone);
  if (telefone.ok && telefone.valor) campos.telefone = telefone.valor;

  if (isRegistro(valor.horario_funcionamento)) {
    const proposto = valor.horario_funcionamento;
    const dias = DIAS_DA_SEMANA.filter((dia) => typeof proposto[dia] === "string" && validarHorarioDia(proposto[dia]) === null);
    if (dias.length > 0) campos.horario_funcionamento = Object.fromEntries(dias.map((dia) => [dia, proposto[dia] as string]));
  }

  // Como no `proporCafeNovo`: sinal sem texto, trecho ou link não sustenta nada.
  const sinais = (Array.isArray(valor.sinais) ? valor.sinais : []).flatMap((s): Sinal[] => {
    if (!isRegistro(s)) return [];
    const [sinal, trecho, url] = [s.sinal, s.trecho, s.url].map(textoAparado);
    return sinal && trecho && url ? [{ sinal, trecho, url }] : [];
  });
  return { campos, sinais };
}

/**
 * O que o "Editar no café" (#186) põe no formulário: o campo da revisão com o
 * valor proposto, no formato do banco. `null` sem campo, ou com valor fora do
 * formato (o formulário abre sem proposta, em silêncio).
 */
export function propostaDaRevisao(
  revisao: Pick<Revisao, "tipo" | "campo" | "valor_proposto">,
): { campo: CampoDeRevisao; valor: unknown } | null {
  if (revisao.tipo !== "atualizacao" || revisao.campo === null) return null;
  const { campos } = cadastroDaRevisao({ [revisao.campo]: revisao.valor_proposto });
  const valor = (campos as Record<string, unknown>)[revisao.campo];
  return valor === undefined ? null : { campo: revisao.campo, valor };
}

/** O mesmo valor de campo, com as chaves do horário em qualquer ordem. */
export function mesmoValor(a: unknown, b: unknown): boolean {
  return canonico(a) === canonico(b);
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
  return n === 1 ? "1 revisão pendente" : `${milhar(n)} revisões pendentes`;
}

const diaEMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit" });

/** "28/10" — o dia da revisão em Recife (o aviso do "Editar no café", #186). */
export function formatarDiaDaRevisao(iso: string): string {
  return diaEMes.format(new Date(iso));
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
