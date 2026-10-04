/**
 * Regras puras do upload de foto do admin (#46) — sem React, sem Supabase: o
 * formulário (no navegador) e as Server Actions aplicam as mesmas decisões.
 */

import { isUuid } from "./admin-auth";

const MB = 1024 * 1024;

/** O que a administradora pode escolher. O navegador converte para WebP antes de subir. */
export const TIPOS_ENTRADA = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_ENTRADA = 15 * MB;

type Arquivo = { type: string; size: number };

/** Foto escolhida, antes de converter: mensagem do problema ou `null`. */
export function checarArquivo({ type, size }: Arquivo): string | null {
  if (!(TIPOS_ENTRADA as readonly string[]).includes(type)) return "Use uma foto JPEG, PNG ou WebP.";
  if (size <= 0) return "O arquivo está vazio.";
  if (size > MAX_ENTRADA) return "A foto tem mais de 15 MB.";
  return null;
}

/** O que o bucket `cafe-fotos` aceita — espelha `allowed_mime_types` e `file_size_limit`. */
const TIPO_FOTO = "image/webp";
const MAX_FOTO = 2 * MB;

export const ERRO_SEM_WEBP =
  "Este navegador não consegue converter a foto para WebP. Use o Chrome, o Edge ou o Firefox.";
export const ERRO_WEBP_GRANDE = "A foto convertida passou de 2 MB. Tente uma foto com menos detalhes.";

/**
 * Resultado da conversão, antes de subir. O Safari ignora o pedido de WebP do
 * canvas e devolve PNG em silêncio: aí, outro navegador.
 */
export function checarWebp({ type, size }: Arquivo): string | null {
  if (type !== TIPO_FOTO) return ERRO_SEM_WEBP;
  if (size > MAX_FOTO) return ERRO_WEBP_GRANDE;
  return null;
}

/** Lado maior da foto publicada: nítida no carrossel, leve no card. */
const LADO_MAIOR = 1600;

/** Tamanho para redimensionar no navegador: lado maior em `LADO_MAIOR`, sem ampliar. */
export function dimensoesDestino(largura: number, altura: number): { largura: number; altura: number } {
  const escala = Math.min(1, LADO_MAIOR / Math.max(largura, altura));
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

// `en-CA` formata como `AAAA-MM-DD`, o valor do `<input type="date">`.
const dataEmRecife = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje em Recife (`AAAA-MM-DD`) — a Vercel roda em UTC. */
export function hojeEmRecife(agora: Date): string {
  return dataEmRecife.format(agora);
}

export type Origem = "propria" | "cedida";

/** Nome da origem na tela — o mesmo no formulário e na lista de fotos. */
export const ROTULO_ORIGEM: Record<Origem, string> = { propria: "Própria", cedida: "Cedida pelo café" };

/** Registro de autorização de uma foto — espelha as colunas de `cafe_fotos`. */
export type Autorizacao = {
  origem: Origem;
  autorizado_por: string;
  /** `AAAA-MM-DD`. */
  autorizado_em: string;
  observacao: string | null;
};

export type CampoAutorizacao = keyof Autorizacao;

export type ResultadoAutorizacao =
  | { ok: true; valores: Autorizacao }
  | { ok: false; erros: Partial<Record<CampoAutorizacao, string>> };

export const MAX_AUTORIZADO_POR = 120;
export const MAX_OBSERVACAO = 500;

const ORIGENS: readonly string[] = ["propria", "cedida"] satisfies Origem[];

const textoAparado = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T00:00:00Z`);
  // `Date` aceita 30/02 e rola para março: a volta precisa dar a mesma data.
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(iso);
}

/**
 * Autorização de uso da foto, obrigatória junto com o arquivo: origem, quem
 * autorizou e data (até `hoje`, em Recife). Mesma regra no formulário e na
 * Server Action — a do servidor é a que vale. Espelha os `check` do banco.
 */
export function validarAutorizacao(
  campos: Partial<Record<CampoAutorizacao, unknown>>,
  hoje: string,
): ResultadoAutorizacao {
  const origem = textoAparado(campos.origem);
  const autorizadoPor = textoAparado(campos.autorizado_por);
  const autorizadoEm = textoAparado(campos.autorizado_em);
  const observacao = textoAparado(campos.observacao);
  const erros: Partial<Record<CampoAutorizacao, string>> = {};

  if (!ORIGENS.includes(origem)) erros.origem = "Escolha a origem da foto.";

  if (!autorizadoPor) erros.autorizado_por = "Diga quem autorizou.";
  else if (autorizadoPor.length > MAX_AUTORIZADO_POR) erros.autorizado_por = `Use até ${MAX_AUTORIZADO_POR} caracteres.`;

  if (!autorizadoEm) erros.autorizado_em = "Informe a data da autorização.";
  else if (!dataValida(autorizadoEm)) erros.autorizado_em = "Data inválida.";
  // `AAAA-MM-DD` compara certo como texto.
  else if (autorizadoEm > hoje) erros.autorizado_em = "A data não pode ser no futuro.";

  if (observacao.length > MAX_OBSERVACAO) erros.observacao = `Use até ${MAX_OBSERVACAO} caracteres.`;

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    valores: {
      origem: origem as Origem,
      autorizado_por: autorizadoPor,
      autorizado_em: autorizadoEm,
      observacao: observacao || null,
    },
  };
}

/** Caminho no bucket `cafe-fotos`: `{cafe_id}/{uuid}.webp`, gerado no servidor. */
export function caminhoDaFoto(cafeId: string, fotoId: string): string {
  return `${cafeId}/${fotoId}.webp`;
}

/**
 * O caminho é uma foto deste café, no formato de `caminhoDaFoto`? Guarda das
 * Server Actions: o cliente devolve o caminho que recebeu, e só ele é aceito.
 */
export function ehCaminhoDoCafe(cafeId: string, caminho: unknown): boolean {
  if (!isUuid(cafeId) || typeof caminho !== "string") return false;
  const [pasta, arquivo, ...resto] = caminho.split("/");
  if (pasta !== cafeId || resto.length > 0 || !arquivo?.endsWith(".webp")) return false;
  return isUuid(arquivo.slice(0, -".webp".length));
}
