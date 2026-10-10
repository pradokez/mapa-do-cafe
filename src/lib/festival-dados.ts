/**
 * Festivais no admin (#102): validação e normalização de uma edição e dos
 * participantes, comum aos formulários e às Server Actions. Espelha os checks
 * de `festival_edicoes` e `festival_participacoes`. Sem React, sem Supabase.
 */

import type { Cafe } from "./cafe";
import { filtrarCafes, FILTROS_VAZIOS } from "./cafe-filter";
import { estadoDaEdicao, rotuloDeStatus, type Edicao, type EstadoEdicao, type Participacao } from "./festival";

const textoAparado = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

const objeto = (entrada: unknown): Record<string, unknown> =>
  entrada && typeof entrada === "object" ? (entrada as Record<string, unknown>) : {};

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` de um dia que existe (o `<input type="date">` manda assim), ou `null`. */
function lerData(valor: unknown): string | null {
  const texto = textoAparado(valor);
  const partes = DATA.exec(texto);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? texto : null;
}

const PRECO = /^(\d{1,4})(?:[.,](\d{1,2}))?$/;

/** "34,90", "34.90", "R$ 34,9" ou "45" → centavos; vazio → `null`; ilegível ou zero → `undefined`. */
function lerPreco(valor: unknown): number | null | undefined {
  const texto = textoAparado(valor).replace(/^R\$\s*/i, "");
  if (!texto) return null;
  const partes = PRECO.exec(texto);
  if (!partes) return undefined;
  const centavos = Number(partes[1]) * 100 + Number((partes[2] ?? "0").padEnd(2, "0"));
  return centavos > 0 ? centavos : undefined;
}

export const MAX_DESCRICAO = 1000;

export type DadosEdicao = {
  /** Sempre o ano do início (o banco exige). */
  ano: number;
  inicio: string;
  fim: string;
  descricao: string | null;
  /** Centavos. */
  preco: number | null;
};

export type CampoEdicao = "inicio" | "fim" | "descricao" | "preco";
export type ErrosEdicao = Partial<Record<CampoEdicao, string>>;
export type ResultadoEdicao = { ok: true; valores: DadosEdicao } | { ok: false; erros: ErrosEdicao };

/** Datas, descrição e preço de uma edição. Chave a mais é ignorada. */
export function validarEdicao(entrada: unknown): ResultadoEdicao {
  const campos = objeto(entrada);
  const erros: ErrosEdicao = {};

  const inicio = lerData(campos.inicio);
  const fim = lerData(campos.fim);
  if (!inicio) erros.inicio = "Informe a data de início.";
  if (!fim) erros.fim = "Informe a data de fim.";
  else if (inicio && fim < inicio) erros.fim = "O fim não pode ser antes do início.";

  const descricao = textoAparado(campos.descricao);
  if (descricao.length > MAX_DESCRICAO) erros.descricao = `Use no máximo ${MAX_DESCRICAO} caracteres.`;

  const preco = lerPreco(campos.preco);
  if (preco === undefined) erros.preco = "Use um valor como 34,90.";

  if (Object.keys(erros).length > 0 || !inicio || !fim || preco === undefined) return { ok: false, erros };
  return {
    ok: true,
    valores: { ano: Number(inicio.slice(0, 4)), inicio, fim, descricao: descricao || null, preco },
  };
}

type Normalizado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const HOSTS_INSTAGRAM = ["instagram.com", "www.instagram.com"];
const CODIGO_DO_POST = /^[A-Za-z0-9_-]{1,64}$/;
const ERRO_POST = "Cole o link do post ou do reel no Instagram.";

/**
 * Link do post (ou reel) da arte → `https://www.instagram.com/p/{código}/`,
 * sem `?igsh=` nem `utm_*`; vazio → `null`. Vira o `href` de "Ver no
 * Instagram": perfil, outro site e outro esquema são recusados.
 */
export function normalizarPostInstagram(valor: unknown): Normalizado<string | null> {
  const texto = textoAparado(valor);
  if (!texto) return { ok: true, valor: null };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return { ok: false, erro: ERRO_POST };
  }
  if (url.protocol !== "https:" || !HOSTS_INSTAGRAM.includes(url.hostname)) return { ok: false, erro: ERRO_POST };

  // `/p/{código}`, `/reel/{código}` ou, no link copiado do perfil, `/{usuario}/p/{código}`.
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.findIndex((parte) => parte === "p" || parte === "reel");
  const codigo = partes[i + 1];
  if (i < 0 || i > 1 || partes.length !== i + 2 || !CODIGO_DO_POST.test(codigo)) return { ok: false, erro: ERRO_POST };
  return { ok: true, valor: `https://www.instagram.com/${partes[i]}/${codigo}/` };
}

export const MAX_NOME_COMBO = 120;
export const MAX_ALT = 1000;
const NUMERO = /^\d{1,4}$/;

export type DadosParticipante = {
  numero: number | null;
  nome_combo: string | null;
  alt: string | null;
  instagram_url: string | null;
};

export type CampoParticipante = keyof DadosParticipante;
export type ErrosParticipante = Partial<Record<CampoParticipante, string>>;
export type ResultadoParticipante =
  | { ok: true; valores: DadosParticipante }
  | { ok: false; erros: ErrosParticipante };

/**
 * Número, nome curto, texto alternativo e link do post de um participante.
 * Tudo opcional (o café participa antes de a arte chegar), menos o alt de quem
 * já tem arte — `temArte` vem do banco, nunca do formulário.
 */
export function validarParticipante(entrada: unknown, { temArte }: { temArte: boolean }): ResultadoParticipante {
  const campos = objeto(entrada);
  const erros: ErrosParticipante = {};

  const numeroTexto = textoAparado(campos.numero);
  const numero = numeroTexto ? Number(numeroTexto) : null;
  if (numeroTexto && (!NUMERO.test(numeroTexto) || numero === 0)) erros.numero = "Use um número inteiro, como 13.";

  const nomeCombo = textoAparado(campos.nome_combo);
  if (nomeCombo.length > MAX_NOME_COMBO) erros.nome_combo = `Use no máximo ${MAX_NOME_COMBO} caracteres.`;

  const alt = textoAparado(campos.alt);
  if (alt.length > MAX_ALT) erros.alt = `Use no máximo ${MAX_ALT} caracteres.`;
  else if (!alt && temArte) erros.alt = "Descreva a arte: o texto do combo está dentro da imagem.";

  const instagram = normalizarPostInstagram(campos.instagram_url);
  if (!instagram.ok) erros.instagram_url = instagram.erro;

  if (Object.keys(erros).length > 0 || !instagram.ok) return { ok: false, erros };
  return {
    ok: true,
    valores: { numero, nome_combo: nomeCombo || null, alt: alt || null, instagram_url: instagram.valor },
  };
}

/** Outro participante da edição que já usa este número (o banco também recusa, com `unique`). */
export function donoDoNumero<P extends { id: string; numero: number | null }>(
  participacoes: readonly P[],
  participacaoId: string,
  numero: number | null,
): P | undefined {
  if (numero === null) return undefined;
  return participacoes.find((p) => p.id !== participacaoId && p.numero === numero);
}

export type StatusNoAdmin = "rascunho" | EstadoEdicao;

/**
 * Etiqueta da edição no painel: "Rascunho" enquanto não publicada (o site não
 * a vê, seja qual for a data); publicada, o estado pelo dia de Recife.
 */
export function statusNoAdmin(
  edicao: Pick<Edicao, "publicada" | "inicio" | "fim">,
  agora: Date,
): { status: StatusNoAdmin; rotulo: string } {
  if (!edicao.publicada) return { status: "rascunho", rotulo: "Rascunho" };
  const status = estadoDaEdicao(edicao, agora);
  if (status === "ativa") return { status, rotulo: "No ar" };
  if (status === "encerrada") return { status, rotulo: "Encerrada" };
  const comeca = rotuloDeStatus(edicao, agora);
  return { status, rotulo: `Publicada · ${comeca[0].toLowerCase()}${comeca.slice(1)}` };
}

/** Por que a edição não pode ir ao ar, ou `null` (o banco também exige o preço). */
export function erroDePublicacao(edicao: Pick<Edicao, "preco">): string | null {
  return edicao.preco === null ? "Preencha o preço do combo antes de publicar." : null;
}

/** O que falta completar nos participantes: a lista do painel e o topo da edição. */
export function pendencias(participacoes: readonly Pick<Participacao, "numero" | "arte">[]): {
  semNumero: number;
  semArte: number;
} {
  return {
    semNumero: participacoes.filter((p) => p.numero === null).length,
    semArte: participacoes.filter((p) => p.arte === null).length,
  };
}

/** Cafés no ar que ainda não estão na edição, pela mesma busca do site (nome ou bairro). */
export function cafesParaAdicionar(
  cafes: Cafe[],
  participacoes: readonly Pick<Participacao, "cafe_id">[],
  q: string,
): Cafe[] {
  const naEdicao = new Set(participacoes.map((p) => p.cafe_id));
  const candidatos = cafes.filter((cafe) => cafe.ativo && !naEdicao.has(cafe.id));
  return filtrarCafes(candidatos, { ...FILTROS_VAZIOS, q });
}
