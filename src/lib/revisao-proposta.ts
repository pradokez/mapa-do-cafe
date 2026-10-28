/**
 * Propostas de curadoria (PRD #167) — sem React, sem Supabase. O modelo extrai
 * fatos de páginas; este módulo decide o que vira revisão: normaliza pelos
 * validadores do `cafe-dados`, propõe só o que difere do banco e nunca devolve
 * o que a administradora rejeitou há pouco. Duas portas: um café que já está
 * no banco (`proporRevisoes`, #180) e um candidato a café novo
 * (`proporCafeNovo`, #184).
 */

import type { Cafe, Cidade, DiaSemana, FaixaPreco } from "./cafe";
import {
  BOOLEANOS,
  CIDADES,
  FAIXAS,
  MAX_TEXTO,
  normalizarInstagram,
  normalizarTelefone,
  slugify,
  textoAparado,
  validarHorarioDia,
} from "./cafe-dados";
import { DIAS_DA_SEMANA } from "./cafe-hours";

/** Um (café, campo, valor) rejeitado não volta por tantos dias. */
export const DIAS_DE_REJEICAO = 90;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/** De onde o fato saiu: o que a administradora vê para conferir. */
export type FonteDoFato = {
  url: string;
  titulo: string;
  /** A data como aparece na página; `null` sem data visível. */
  data_fonte: string | null;
  /** Trecho literal da página de onde o fato saiu. */
  trecho: string;
};

export type Fato<T> = FonteDoFato & { valor: T };

/** Booleano extraído; `negacaoExplicita` só quando a fonte diz que NÃO tem ("não aceita pets"). */
export type FatoBooleano = Fato<boolean> & { negacaoExplicita?: boolean };

export const CAMPOS_BOOLEANOS = [...BOOLEANOS, "tem_ar_condicionado"] as const;
export type CampoBooleano = (typeof CAMPOS_BOOLEANOS)[number];

/** Campos de `cafes` que a revisão confere (endereço sem lat/lng, de propósito). */
export type CampoRevisado =
  | "horario_funcionamento"
  | "instagram"
  | "telefone"
  | "endereco"
  | "faixa_preco"
  | CampoBooleano;

export type Situacao = "permanente" | "temporaria";

/** O que o modelo extraiu das páginas de um café. Tudo opcional; cada lista tem uma entrada por fonte. */
export type FatosDoCafe = {
  horario?: Fato<Partial<Record<DiaSemana, string>>>[];
  instagram?: Fato<string>[];
  telefone?: Fato<string>[];
  endereco?: Fato<string>[];
  faixa_preco?: Fato<string>[];
  booleanos?: Partial<Record<CampoBooleano, FatoBooleano[]>>;
  situacao?: Fato<Situacao>[];
};

export type Rejeitada = {
  cafeId: string;
  /** `null` para fechamento e indício. */
  campo: string | null;
  valor: unknown;
  /** Quando foi rejeitada (ISO). */
  rejeitadaEm: string;
};

/** Cada fonte da proposta com o valor que ela sustenta (já normalizado); fontes que discordam entram todas. */
export type FonteDaProposta = FonteDoFato & { valor: unknown };

export const FECHADO_PERMANENTEMENTE = "fechado_permanentemente";
export const FECHADO_TEMPORARIAMENTE = "fechado_temporariamente";

export type Proposta = {
  tipo: "atualizacao" | "fechamento";
  cafeId: string;
  /** `null` em fechamento e no indício de fechado temporariamente. */
  campo: CampoRevisado | null;
  valorAtual: unknown;
  valorProposto: unknown;
  fontes: FonteDaProposta[];
};

type Candidato = { fonte: FonteDoFato; valor: unknown };

/** JSON com chaves em ordem: o `jsonb` não preserva a ordem do horário. */
export function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/** Abreviações de logradouro e título que as páginas alternam com a palavra inteira. */
const ABREVIACOES: Record<string, string> = {
  r: "rua", av: "avenida", al: "alameda", tv: "travessa", trav: "travessa", estr: "estrada", pca: "praca", pc: "praca",
  gov: "governador", des: "desembargador", dr: "doutor", prof: "professor", eng: "engenheiro", cel: "coronel",
  mal: "marechal", sen: "senador", pres: "presidente", cap: "capitao", gen: "general", sta: "santa", sto: "santo",
};
/** O que as páginas acrescentam a um endereço sem mudá-lo: cidade, UF, país, preposição e "nº". */
const FORA_DO_ENDERECO = new Set([
  "recife", "olinda", "jaboatao", "guararapes", "pe", "pernambuco", "brasil", "brazil",
  "de", "da", "do", "das", "dos", "n", "no", "numero",
]);

/**
 * Endereço → chave de comparação (#190): sem caixa, acento, pontuação, CEP,
 * cidade, UF e país, com as abreviações por extenso. "R. das Creoulas, 55 -
 * Graças" e "Rua das Creoulas, 55, Graças, Recife, PE" dão a mesma chave.
 */
function chaveDoEndereco(endereco: string): string {
  return slugify(endereco.replace(/\b\d{5}-?\d{3}\b/g, " "))
    .split("-")
    .map((palavra) => ABREVIACOES[palavra] ?? palavra)
    .filter((palavra) => palavra !== "" && !FORA_DO_ENDERECO.has(palavra))
    .join(" ");
}

/**
 * Chave para comparar valores de um campo: o `canonico`, e no endereço a
 * `chaveDoEndereco` — o mesmo lugar escrito de outro jeito não é outro valor.
 */
export function chaveDoValor(campo: string | null, valor: unknown): string {
  return campo === "endereco" && typeof valor === "string" ? chaveDoEndereco(valor) : canonico(valor);
}

const fonteDe = ({ url, titulo, data_fonte, trecho }: FonteDoFato): FonteDoFato => ({ url, titulo, data_fonte, trecho });

function rejeitadaRecente(
  rejeitadas: Rejeitada[],
  cafeId: string,
  campo: string | null,
  valor: unknown,
  agora: Date,
): boolean {
  const chave = chaveDoValor(campo, valor);
  return rejeitadas.some(({ cafeId: id, campo: c, valor: v, rejeitadaEm }) => {
    if (id !== cafeId || c !== campo || chaveDoValor(c, v) !== chave) return false;
    const idade = agora.getTime() - new Date(rejeitadaEm).getTime();
    return idade < DIAS_DE_REJEICAO * DIA_EM_MS;
  });
}

/**
 * Candidatos de um campo → proposta, ou `null`. O valor proposto é o mais
 * sustentado entre os que diferem do banco e não foram rejeitados há pouco
 * (empate: o que apareceu primeiro); as fontes são todas as válidas.
 */
function proporCampo(
  cafe: Cafe,
  campo: CampoRevisado,
  candidatos: Candidato[],
  rejeitadas: Rejeitada[],
  agora: Date,
): Proposta | null {
  const atual = cafe[campo];
  const chaveAtual = chaveDoValor(campo, atual);

  const votos = new Map<string, { valor: unknown; n: number }>();
  for (const { valor } of candidatos) {
    const chave = chaveDoValor(campo, valor);
    if (chave === chaveAtual || rejeitadaRecente(rejeitadas, cafe.id, campo, valor, agora)) continue;
    const voto = votos.get(chave) ?? { valor, n: 0 };
    voto.n += 1;
    votos.set(chave, voto);
  }
  const vencedor = Array.from(votos.values()).reduce<{ valor: unknown; n: number } | null>(
    (melhor, voto) => (melhor && melhor.n >= voto.n ? melhor : voto),
    null,
  );
  if (!vencedor) return null;

  return {
    tipo: "atualizacao",
    cafeId: cafe.id,
    campo,
    valorAtual: atual,
    valorProposto: vencedor.valor,
    fontes: candidatos.map(({ fonte, valor }) => ({ ...fonteDe(fonte), valor })),
  };
}

/** Texto aparado dentro do limite, ou `null`. */
function textoAte(valor: unknown, maximo: number): string | null {
  const texto = textoAparado(valor);
  return texto && texto.length <= maximo ? texto : null;
}

const faixaDe = (valor: unknown): FaixaPreco | null => FAIXAS.find((f) => f === textoAparado(valor)) ?? null;

function candidatosDeTexto(
  fatos: Fato<string>[] | undefined,
  normalizar: (valor: string) => string | null,
): Candidato[] {
  return (fatos ?? []).flatMap((fato) => {
    const valor = normalizar(fato.valor);
    return valor === null ? [] : [{ fonte: fato, valor }];
  });
}

/** Normalizador de `cafe-dados` → texto, ou `null` se inválido ou vazio (nunca propõe apagar). */
const doNormalizador =
  (normalizar: (valor: unknown) => ReturnType<typeof normalizarInstagram>) =>
  (valor: string): string | null => {
    const resultado = normalizar(valor);
    return resultado.ok ? resultado.valor : null;
  };

function candidatosDeHorario(fatos: Fato<Partial<Record<DiaSemana, string>>>[] | undefined, cafe: Cafe): Candidato[] {
  return (fatos ?? []).flatMap((fato) => {
    const horario = { ...cafe.horario_funcionamento };
    let achou = false;
    for (const dia of DIAS_DA_SEMANA) {
      const texto = fato.valor[dia];
      if (texto === undefined || validarHorarioDia(texto) !== null) continue;
      horario[dia] = texto;
      achou = true;
    }
    return achou ? [{ fonte: fato, valor: horario }] : [];
  });
}

/** `false` só com negação explícita (nunca por falta de menção); `true` vale sempre. */
const booleanoAceito = ({ valor, negacaoExplicita }: Pick<FatoBooleano, "valor" | "negacaoExplicita">) =>
  typeof valor === "boolean" && (valor || negacaoExplicita === true);

/** O `null` do ar-condicionado vira o valor que a fonte dá. */
function candidatosBooleanos(fatos: FatoBooleano[] | undefined): Candidato[] {
  return (fatos ?? []).flatMap((fato) => (booleanoAceito(fato) ? [{ fonte: fato, valor: fato.valor }] : []));
}

function propostasDeSituacao(
  cafe: Cafe,
  situacoes: Fato<Situacao>[] | undefined,
  rejeitadas: Rejeitada[],
  agora: Date,
): Proposta[] {
  if (!cafe.ativo) return [];
  const propostas: Proposta[] = [];
  const casos: [Situacao, Proposta["tipo"], string][] = [
    ["permanente", "fechamento", FECHADO_PERMANENTEMENTE],
    ["temporaria", "atualizacao", FECHADO_TEMPORARIAMENTE],
  ];
  for (const [situacao, tipo, valorProposto] of casos) {
    const fontes = (situacoes ?? []).filter((fato) => fato.valor === situacao);
    if (fontes.length === 0 || rejeitadaRecente(rejeitadas, cafe.id, null, valorProposto, agora)) continue;
    propostas.push({
      tipo,
      cafeId: cafe.id,
      campo: null,
      valorAtual: null,
      valorProposto,
      fontes: fontes.map((fato) => ({ ...fonteDe(fato), valor: valorProposto })),
    });
  }
  return propostas;
}

/**
 * Fatos extraídos de um café + o café no banco + as rejeitadas → propostas de
 * `atualizacao` e `fechamento`. Igual ao banco, inválido, ou rejeitado há menos
 * de 90 dias → nada.
 */
export function proporRevisoes(fatos: FatosDoCafe, cafe: Cafe, rejeitadas: Rejeitada[], agora: Date): Proposta[] {
  const porCampo: [CampoRevisado, Candidato[]][] = [
    ["horario_funcionamento", candidatosDeHorario(fatos.horario, cafe)],
    ["instagram", candidatosDeTexto(fatos.instagram, doNormalizador(normalizarInstagram))],
    ["telefone", candidatosDeTexto(fatos.telefone, doNormalizador(normalizarTelefone))],
    ["endereco", candidatosDeTexto(fatos.endereco, (valor) => textoAte(valor, MAX_TEXTO.endereco))],
    ["faixa_preco", candidatosDeTexto(fatos.faixa_preco, faixaDe)],
    ...CAMPOS_BOOLEANOS.map((campo): [CampoRevisado, Candidato[]] => [campo, candidatosBooleanos(fatos.booleanos?.[campo])]),
  ];

  const propostas = porCampo.flatMap(([campo, candidatos]) => proporCampo(cafe, campo, candidatos, rejeitadas, agora) ?? []);
  return [...propostasDeSituacao(cafe, fatos.situacao, rejeitadas, agora), ...propostas];
}

/** Casas que entram como café novo mesmo sem sinal de café especial (PRD #167), pelo nome normalizado. */
export const EXCECOES_DE_CAFE_NOVO = ["santa-clara", "sao-braz"] as const;

const PALAVRAS_DE_CAFE = new Set(["cafe", "cafes", "cafeteria", "coffee"]);
const DEPOIS_DE_COFFEE = new Set(["shop", "house"]);

/**
 * Nome → chave para reconhecer o mesmo café: `slugify` sem "café",
 * "cafeteria", "coffee" (e "coffee shop/house") nas pontas — "Cafeteria Santa
 * Clara" e "Santa Clara Café" são o mesmo. O meio do nome fica. Se não sobrar
 * nada, o slug inteiro.
 */
export function nomeNormalizado(nome: string): string {
  const slug = slugify(nome);
  const palavras = slug.split("-").filter(Boolean);
  for (;;) {
    const [primeira, segunda] = palavras;
    const [ultima, penultima] = [palavras[palavras.length - 1], palavras[palavras.length - 2]];
    if (primeira === "coffee" && DEPOIS_DE_COFFEE.has(segunda)) palavras.splice(0, 2);
    else if (PALAVRAS_DE_CAFE.has(primeira)) palavras.shift();
    else if (penultima === "coffee" && DEPOIS_DE_COFFEE.has(ultima)) palavras.splice(-2);
    else if (PALAVRAS_DE_CAFE.has(ultima)) palavras.pop();
    else break;
  }
  return palavras.length > 0 ? palavras.join("-") : slug;
}

/** Indício de café especial (origem do grão, torra própria, métodos filtrados…), com o trecho literal. */
export type Sinal = { sinal: string; trecho: string; url: string };

/** O que o modelo extraiu de um café que não está no banco. Só nome e cidade são obrigatórios. */
export type CandidatoCafeNovo = {
  nome: string;
  cidade: string;
  bairro?: string | null;
  endereco?: string | null;
  instagram?: string | null;
  telefone?: string | null;
  horario?: Partial<Record<DiaSemana, string>> | null;
  faixa_preco?: string | null;
  booleanos?: Partial<Record<CampoBooleano, Pick<FatoBooleano, "valor" | "negacaoExplicita">>>;
  sinais: Sinal[];
  fontes: FonteDoFato[];
};

/** O `valor_proposto` do `cafe_novo` (contrato na migration): sem slug, lat e lng; opcionais só quando validam. */
export type CafeNovoProposto = {
  nome: string;
  cidade: Cidade;
  bairro?: string;
  endereco?: string;
  instagram?: string;
  telefone?: string;
  horario_funcionamento?: Partial<Record<DiaSemana, string>>;
  faixa_preco?: FaixaPreco;
  sinais: Sinal[];
} & Partial<Record<CampoBooleano, boolean>>;

export type PropostaCafeNovo = {
  tipo: "cafe_novo";
  nomeNormalizado: string;
  valorProposto: CafeNovoProposto;
  fontes: FonteDoFato[];
};

/** "recife", "Jaboatao dos Guararapes" e "Jaboatão" sozinho → a cidade do banco. */
function cidadeDoCandidato(valor: string): Cidade | null {
  const chave = slugify(valor);
  if (chave === "jaboatao") return "Jaboatão dos Guararapes";
  return CIDADES.find((cidade) => slugify(cidade) === chave) ?? null;
}

function ehExcecao(nome: string): boolean {
  return EXCECOES_DE_CAFE_NOVO.some((excecao) => nome === excecao || nome.startsWith(`${excecao}-`));
}

/**
 * Candidato a café novo + todos os cafés do banco (ativos e inativos) + os
 * nomes normalizados dos cafés novos rejeitados → proposta `cafe_novo`, ou
 * `null`. Fora das três cidades, sem sinal de café especial com trecho (salvo
 * as exceções), já no banco ou já rejeitado (nunca volta) → nada.
 */
export function proporCafeNovo(
  candidato: CandidatoCafeNovo,
  cafes: Pick<Cafe, "nome">[],
  rejeitados: string[],
): PropostaCafeNovo | null {
  const nome = textoAte(candidato.nome, MAX_TEXTO.nome);
  const cidade = cidadeDoCandidato(candidato.cidade);
  if (!nome || !cidade) return null;

  const chave = nomeNormalizado(nome);
  const sinais = candidato.sinais.filter(({ sinal, trecho, url }) => textoAparado(sinal) && textoAparado(trecho) && textoAparado(url));
  if (sinais.length === 0 && !ehExcecao(chave)) return null;
  if (cafes.some((cafe) => nomeNormalizado(cafe.nome) === chave)) return null;
  if (rejeitados.some((rejeitado) => nomeNormalizado(rejeitado) === chave)) return null;

  const proposto: CafeNovoProposto = { nome, cidade, sinais };
  const bairro = textoAte(candidato.bairro, MAX_TEXTO.bairro);
  if (bairro) proposto.bairro = bairro;
  const endereco = textoAte(candidato.endereco, MAX_TEXTO.endereco);
  if (endereco) proposto.endereco = endereco;
  const instagram = doNormalizador(normalizarInstagram)(candidato.instagram ?? "");
  if (instagram) proposto.instagram = instagram;
  const telefone = doNormalizador(normalizarTelefone)(candidato.telefone ?? "");
  if (telefone) proposto.telefone = telefone;

  const horario = Object.fromEntries(
    DIAS_DA_SEMANA.flatMap((dia) => {
      const texto = candidato.horario?.[dia];
      return texto !== undefined && validarHorarioDia(texto) === null ? [[dia, texto]] : [];
    }),
  );
  if (Object.keys(horario).length > 0) proposto.horario_funcionamento = horario;

  const faixa = faixaDe(candidato.faixa_preco);
  if (faixa) proposto.faixa_preco = faixa;

  for (const campo of CAMPOS_BOOLEANOS) {
    const fato = candidato.booleanos?.[campo];
    if (fato && booleanoAceito(fato)) proposto[campo] = fato.valor;
  }

  return { tipo: "cafe_novo", nomeNormalizado: chave, valorProposto: proposto, fontes: candidato.fontes.map(fonteDe) };
}
