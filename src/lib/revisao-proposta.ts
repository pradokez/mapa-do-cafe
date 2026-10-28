/**
 * Revisão de cafés existentes (PRD #167, #180) — sem React, sem Supabase, sem
 * rede: o robô de curadoria extrai fatos de páginas e este módulo decide o que
 * vira proposta. O modelo extrai, o código decide.
 */

import type { Cafe, DiaSemana } from "./cafe";
import { FAIXAS, MAX_TEXTO, normalizarInstagram, normalizarTelefone, validarHorarioDia } from "./cafe-dados";
import { DIAS_DA_SEMANA, isRegistro } from "./cafe-hours";

/** Um (café, campo, valor) rejeitado só volta depois disto. */
export const DIAS_SEM_VOLTAR = 90;
const DIA_EM_MS = 24 * 60 * 60 * 1000;

export type FonteDoFato = {
  url: string;
  titulo: string;
  /** A data como aparece na página; `null` se não aparece. */
  data_fonte: string | null;
  /** Trecho literal de onde o fato saiu. */
  trecho: string;
};

/** O que uma fonte disse. Só `valor`, `fonte` e `negacao_explicita` são lidos: qualquer outra chave do modelo (lat, lng…) é ignorada. */
export type Fato<T> = {
  valor: T;
  fonte: FonteDoFato;
  /** Atributo booleano: a fonte nega com todas as letras ("não aceita pets"), não só deixa de citar. */
  negacao_explicita?: boolean;
};

export const ATRIBUTOS_VERIFICADOS = [
  "aceita_pets",
  "tem_estacionamento",
  "permite_coffee_office",
  "acessivel_pcd",
  "opcoes_vegetarianas",
  "tem_ar_condicionado",
] as const satisfies ReadonlyArray<keyof Cafe>;

export type AtributoVerificado = (typeof ATRIBUTOS_VERIFICADOS)[number];

export type CampoVerificado =
  | "horario_funcionamento"
  | "instagram"
  | "telefone"
  | "endereco"
  | "faixa_preco"
  | AtributoVerificado;

export type FechamentoDoFato = { situacao: "permanente" | "temporario"; fonte: FonteDoFato };

/** Fatos extraídos de um café, por campo; cada campo traz uma entrada por fonte, e as fontes podem discordar. */
export type FatosDoCafe = {
  /** Só os dias que a fonte informa. */
  horario_funcionamento?: Fato<Partial<Record<DiaSemana, string>>>[];
  instagram?: Fato<string>[];
  telefone?: Fato<string>[];
  endereco?: Fato<string>[];
  faixa_preco?: Fato<string>[];
  fechamento?: FechamentoDoFato[];
} & { [A in AtributoVerificado]?: Fato<boolean>[] };

export type Rejeitada = {
  cafe_id: string;
  /** Um `CampoVerificado`, `"fechamento"` ou `"fechamento_temporario"` (o indício). */
  campo: string;
  valor: unknown;
  rejeitada_em: Date;
};

/** A fonte com o valor que ela deu, já no formato do banco. */
export type FonteComValor = FonteDoFato & { valor: unknown };

export type Proposta =
  | {
      tipo: "atualizacao";
      cafe_id: string;
      campo: CampoVerificado;
      valor_atual: unknown;
      valor_proposto: unknown;
      fontes: FonteComValor[];
      /** As fontes que valem deram valores diferentes. */
      discordam: boolean;
    }
  // "Fechado temporariamente": indício, nada a aplicar no café.
  | { tipo: "atualizacao"; cafe_id: string; campo: null; indicio: "fechado_temporariamente"; fontes: FonteDoFato[] }
  | { tipo: "fechamento"; cafe_id: string; fontes: FonteDoFato[] };

const CAMPOS: readonly CampoVerificado[] = [
  "horario_funcionamento",
  "instagram",
  "telefone",
  "endereco",
  "faixa_preco",
  ...ATRIBUTOS_VERIFICADOS,
];

const ehAtributo = (campo: CampoVerificado): campo is AtributoVerificado =>
  (ATRIBUTOS_VERIFICADOS as readonly string[]).includes(campo);

/** Sem caixa, acento nem espaço repetido: "Rua X,  1" e "rua x, 1" são o mesmo endereço. */
function textoComparavel(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** O valor do fato no formato do banco, ou `null` se não valida pelo `cafe-dados`. */
function normalizar(campo: CampoVerificado, valor: unknown, cafe: Cafe): { valor: unknown } | null {
  switch (campo) {
    case "instagram": {
      const r = normalizarInstagram(valor);
      return r.ok && r.valor !== null ? { valor: r.valor } : null;
    }
    case "telefone": {
      const r = normalizarTelefone(valor);
      return r.ok && r.valor !== null ? { valor: r.valor } : null;
    }
    case "endereco": {
      const texto = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
      return texto && texto.length <= MAX_TEXTO.endereco ? { valor: texto } : null;
    }
    case "faixa_preco":
      return FAIXAS.find((f) => f === valor) ? { valor } : null;
    case "horario_funcionamento": {
      if (!isRegistro(valor)) return null;
      const horario = { ...cafe.horario_funcionamento };
      let algum = false;
      for (const dia of DIAS_DA_SEMANA) {
        if (valor[dia] === undefined || validarHorarioDia(valor[dia]) !== null) continue;
        horario[dia] = valor[dia] as string;
        algum = true;
      }
      return algum ? { valor: horario } : null;
    }
    default:
      return typeof valor === "boolean" ? { valor } : null;
  }
}

function igual(campo: CampoVerificado, a: unknown, b: unknown): boolean {
  switch (campo) {
    case "horario_funcionamento":
      return isRegistro(a) && isRegistro(b) && DIAS_DA_SEMANA.every((dia) => a[dia] === b[dia]);
    case "instagram":
    case "endereco":
      return typeof a === "string" && typeof b === "string" && textoComparavel(a) === textoComparavel(b);
    default:
      return a === b;
  }
}

function rejeitadaRecentemente(rejeitadas: Rejeitada[], cafeId: string, campo: string, valor: unknown, agora: Date): boolean {
  return rejeitadas.some(
    (r) =>
      r.cafe_id === cafeId &&
      r.campo === campo &&
      agora.getTime() - r.rejeitada_em.getTime() < DIAS_SEM_VOLTAR * DIA_EM_MS &&
      (campo === "fechamento" || igual(campo as CampoVerificado, r.valor, valor)),
  );
}

/**
 * Propostas de atualização e fechamento de um café já no banco: só o que difere
 * dele, no formato do banco, e sem o que a administradora rejeitou nos últimos
 * 90 dias. Dados que não passam pelo `cafe-dados` caem em silêncio. Endereço
 * novo nunca leva lat/lng: o pin se confere à mão.
 */
export function propostasDeAtualizacao(
  fatos: FatosDoCafe,
  cafe: Cafe,
  rejeitadas: Rejeitada[],
  agora: Date,
): Proposta[] {
  const propostas: Proposta[] = [];

  const fechamentos = cafe.ativo ? (fatos.fechamento ?? []) : [];
  const permanentes = fechamentos.filter((f) => f.situacao === "permanente").map((f) => f.fonte);
  const temporarios = fechamentos.filter((f) => f.situacao === "temporario").map((f) => f.fonte);
  if (permanentes.length > 0) {
    if (!rejeitadaRecentemente(rejeitadas, cafe.id, "fechamento", null, agora)) {
      propostas.push({ tipo: "fechamento", cafe_id: cafe.id, fontes: permanentes });
    }
  } else if (temporarios.length > 0 && !rejeitadaRecentemente(rejeitadas, cafe.id, "fechamento_temporario", null, agora)) {
    propostas.push({ tipo: "atualizacao", cafe_id: cafe.id, campo: null, indicio: "fechado_temporariamente", fontes: temporarios });
  }

  for (const campo of CAMPOS) {
    const atual = cafe[campo];
    const validos: { fonte: FonteComValor; valor: unknown }[] = [];
    for (const fato of (fatos[campo] ?? []) as Fato<unknown>[]) {
      const normalizado = normalizar(campo, fato.valor, cafe);
      if (!normalizado) continue;
      // Sem negação explícita, "não citou" não vira "não tem": true → false é descartado.
      if (ehAtributo(campo) && atual === true && normalizado.valor === false && fato.negacao_explicita !== true) continue;
      validos.push({ fonte: { ...fato.fonte, valor: normalizado.valor }, valor: normalizado.valor });
    }

    const novo = validos.find((v) => !igual(campo, v.valor, atual));
    if (!novo || rejeitadaRecentemente(rejeitadas, cafe.id, campo, novo.valor, agora)) continue;

    propostas.push({
      tipo: "atualizacao",
      cafe_id: cafe.id,
      campo,
      valor_atual: atual,
      valor_proposto: novo.valor,
      fontes: validos.map((v) => v.fonte),
      discordam: validos.some((v) => !igual(campo, v.valor, novo.valor)),
    });
  }

  return propostas;
}
