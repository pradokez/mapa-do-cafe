/**
 * O que o Gemini devolve para um café (#185, PRD #167): o schema que o prompt
 * pede e a leitura estrita da resposta. Resposta fora do schema lança
 * `ExtracaoInvalida` — o robô trata como falha daquele café, nunca como dado.
 */
import type { DiaSemana } from "../../src/lib/cafe";
import { DIAS_DA_SEMANA } from "../../src/lib/cafe-hours";
import {
  CAMPOS_BOOLEANOS,
  type CampoBooleano,
  type FatosDoCafe,
  type FonteDoFato,
  type Situacao,
} from "../../src/lib/revisao-proposta";

export class ExtracaoInvalida extends Error {}

type Citacao = FonteDoFato;
type ComValor<T> = Citacao & { valor: T };

export type Extracao = {
  horario: ComValor<Partial<Record<DiaSemana, string>>>[];
  instagram: ComValor<string>[];
  telefone: ComValor<string>[];
  endereco: ComValor<string>[];
  faixa_preco: ComValor<string>[];
  booleanos: (ComValor<boolean> & { campo: CampoBooleano; negacao_explicita: boolean })[];
  situacao: ComValor<Situacao>[];
};

const CITACAO = {
  url: { type: "string", description: "URL da página de onde o fato saiu (uma das fornecidas)." },
  titulo: { type: "string", description: "Título da página." },
  data_fonte: {
    type: ["string", "null"],
    description: "A data da informação COMO APARECE na página, no mesmo formato. null se não houver data visível; nunca estime.",
  },
  trecho: { type: "string", description: "Trecho LITERAL da página que sustenta o fato (e a data, se houver). Copie, não parafraseie." },
} as const;

function listaDe(valor: object, extras: object = {}) {
  return {
    type: "array",
    items: {
      type: "object",
      properties: { valor, ...CITACAO, ...extras },
      required: ["valor", "url", "titulo", "data_fonte", "trecho", ...Object.keys(extras)],
    },
  };
}

/** `responseJsonSchema` do Gemini. Fontes que discordam entram todas, sem escolher. */
export const SCHEMA_DA_EXTRACAO = {
  type: "object",
  properties: {
    horario: listaDe({
      type: "object",
      description: 'Horário por dia, "HH:MM – HH:MM" (turnos separados por ", ") ou "Fechado".',
      properties: Object.fromEntries(DIAS_DA_SEMANA.map((dia) => [dia, { type: "string" }])),
    }),
    instagram: listaDe({ type: "string" }),
    telefone: listaDe({ type: "string" }),
    endereco: listaDe({ type: "string" }),
    faixa_preco: listaDe({ type: "string", enum: ["$", "$$", "$$$"] }),
    booleanos: listaDe(
      { type: "boolean" },
      {
        campo: { type: "string", enum: [...CAMPOS_BOOLEANOS] },
        negacao_explicita: { type: "boolean", description: "true só se a fonte diz que NÃO tem (ex.: 'não aceita pets')." },
      },
    ),
    situacao: listaDe({ type: "string", enum: ["permanente", "temporaria"], description: "Fechado permanentemente ou temporariamente." }),
  },
  required: ["horario", "instagram", "telefone", "endereco", "faixa_preco", "booleanos", "situacao"],
} as const;

function registro(valor: unknown, onde: string): Record<string, unknown> {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) throw new ExtracaoInvalida(`${onde}: não é objeto`);
  return valor as Record<string, unknown>;
}

function texto(valor: unknown, onde: string): string {
  if (typeof valor !== "string") throw new ExtracaoInvalida(`${onde}: não é texto`);
  return valor;
}

function citacao(item: Record<string, unknown>, onde: string): Citacao {
  const data = item.data_fonte;
  if (data !== null && typeof data !== "string") throw new ExtracaoInvalida(`${onde}.data_fonte`);
  return { url: texto(item.url, `${onde}.url`), titulo: texto(item.titulo, `${onde}.titulo`), data_fonte: data, trecho: texto(item.trecho, `${onde}.trecho`) };
}

function lista<T>(bruto: Record<string, unknown>, chave: string, ler: (item: Record<string, unknown>, onde: string) => T): T[] {
  const itens = bruto[chave];
  if (!Array.isArray(itens)) throw new ExtracaoInvalida(`${chave}: não é lista`);
  return itens.map((item, i) => ler(registro(item, `${chave}[${i}]`), `${chave}[${i}]`));
}

function comValor<T>(valida: (valor: unknown, onde: string) => T) {
  return (item: Record<string, unknown>, onde: string): ComValor<T> => ({ ...citacao(item, onde), valor: valida(item.valor, `${onde}.valor`) });
}

function oneOf<T extends string>(opcoes: readonly T[]) {
  return (valor: unknown, onde: string): T => {
    if (typeof valor !== "string" || !(opcoes as readonly string[]).includes(valor)) throw new ExtracaoInvalida(`${onde}: valor fora da lista`);
    return valor as T;
  };
}

function horarioDe(valor: unknown, onde: string): Partial<Record<DiaSemana, string>> {
  const dias = registro(valor, onde);
  const saida: Partial<Record<DiaSemana, string>> = {};
  for (const dia of DIAS_DA_SEMANA) {
    if (dias[dia] !== undefined) saida[dia] = texto(dias[dia], `${onde}.${dia}`);
  }
  return saida;
}

/** Resposta do Gemini → extração tipada, ou `ExtracaoInvalida`. */
export function lerExtracao(bruto: unknown): Extracao {
  const raiz = registro(bruto, "extração");
  const textoValido = comValor(texto);
  return {
    horario: lista(raiz, "horario", comValor(horarioDe)),
    instagram: lista(raiz, "instagram", textoValido),
    telefone: lista(raiz, "telefone", textoValido),
    endereco: lista(raiz, "endereco", textoValido),
    faixa_preco: lista(raiz, "faixa_preco", textoValido),
    booleanos: lista(raiz, "booleanos", (item, onde) => {
      const base = comValor((v, o) => {
        if (typeof v !== "boolean") throw new ExtracaoInvalida(`${o}: não é booleano`);
        return v;
      })(item, onde);
      if (typeof item.negacao_explicita !== "boolean") throw new ExtracaoInvalida(`${onde}.negacao_explicita`);
      return { ...base, campo: oneOf(CAMPOS_BOOLEANOS)(item.campo, `${onde}.campo`), negacao_explicita: item.negacao_explicita };
    }),
    situacao: lista(raiz, "situacao", comValor(oneOf(["permanente", "temporaria"] as const))),
  };
}

/** Extração → fatos do `revisao-proposta`, mantendo só as citações que `manter` aprova (o trecho existe na página). */
export function aFatos(extracao: Extracao, manter: (fonte: Citacao) => boolean): FatosDoCafe {
  const ok = <T extends Citacao>(itens: T[]) => itens.filter(manter);
  const booleanos: NonNullable<FatosDoCafe["booleanos"]> = {};
  for (const { campo, negacao_explicita, ...fato } of ok(extracao.booleanos)) {
    (booleanos[campo] ??= []).push({ ...fato, negacaoExplicita: negacao_explicita });
  }
  return {
    horario: ok(extracao.horario),
    instagram: ok(extracao.instagram),
    telefone: ok(extracao.telefone),
    endereco: ok(extracao.endereco),
    faixa_preco: ok(extracao.faixa_preco),
    booleanos,
    situacao: ok(extracao.situacao),
  };
}
