/**
 * Sugestões do público (#83): tipos, limites, normalização do texto e
 * validação — comuns ao formulário e à Server Action. Puro: não importa React
 * nem Supabase.
 */

import { MAX_SLUG, SLUG } from "./cafe-dados";

export const TIPOS_SUGESTAO = ["sugestao", "problema", "outro"] as const;
export type TipoSugestao = (typeof TIPOS_SUGESTAO)[number];

/** Rótulo, dica e placeholder de cada tipo (microcopy do design). */
export const SOBRE_O_TIPO: Record<TipoSugestao, { rotulo: string; dica: string; placeholder: string }> = {
  sugestao: {
    rotulo: "Sugestão",
    dica: "O que deixaria o Mapa do Café melhor pra você? Um filtro, uma informação, um jeito de buscar…",
    placeholder: 'Ex.: um filtro de "aberto agora"',
  },
  problema: {
    rotulo: "Problema",
    dica: "Conte o que você estava fazendo, o que esperava que acontecesse e o que aconteceu.",
    placeholder: 'Ex.: no celular, toquei em "Como chegar" e nada aconteceu',
  },
  outro: { rotulo: "Outro", dica: "Fique à vontade.", placeholder: "Escreva aqui" },
};

export const DICA_SEM_TIPO = "Escolha um tipo acima para ver uma dica.";

export function ehTipoSugestao(valor: unknown): valor is TipoSugestao {
  return TIPOS_SUGESTAO.includes(valor as TipoSugestao);
}

export const MIN_MENSAGEM = 10;
export const MAX_MENSAGEM = 2000;
/** Envios por IP numa hora (quem conta é a função `enviar_sugestao`, no banco). */
export const LIMITE_POR_HORA = 5;

export type DadosSugestao = { tipo: TipoSugestao; mensagem: string; origem: string | null };

export type CamposSugestao = { tipo?: unknown; mensagem?: unknown; origem?: unknown; site?: unknown };

export type ErrosSugestao = { tipo?: string; mensagem?: string };

export type ResultadoSugestao =
  | { ok: true; dados: DadosSugestao }
  | { ok: false; robo?: false; erros: ErrosSugestao }
  | { ok: false; robo: true };

// Controle (menos tab e quebra de linha), largura zero e controle
// bidirecional: invisíveis, servem para esconder ou inverter texto.
const INVISIVEIS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‍⁠﻿‎‏؜‪-‮⁦-⁩]/g;

/**
 * O texto como vai ser guardado: NFC, sem invisíveis, quebras `\n`, no máximo
 * uma linha em branco seguida, sem espaço nas pontas. HTML não é removido nem
 * escapado — quem exibe é que escapa (o React já faz).
 */
export function normalizarMensagem(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIVEIS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Em caracteres (code points), como o `char_length` do Postgres — não em bytes nem em UTF-16. */
export function tamanhoDaMensagem(normalizada: string): number {
  return Array.from(normalizada).length;
}

const milhar = (n: number) => n.toLocaleString("pt-BR");

/** Contador abaixo do campo: "1.998 restantes" ou, acima do limite, "12 a mais". */
export function contadorDaMensagem(texto: string): { rotulo: string; restantes: number } {
  const restantes = MAX_MENSAGEM - tamanhoDaMensagem(normalizarMensagem(texto));
  if (restantes < 0) return { rotulo: `${milhar(-restantes)} a mais`, restantes };
  return { rotulo: `${milhar(restantes)} ${restantes === 1 ? "restante" : "restantes"}`, restantes };
}

function erroDaMensagem(normalizada: string): string | undefined {
  const tamanho = tamanhoDaMensagem(normalizada);
  if (tamanho === 0) return "Escreva sua mensagem.";
  if (tamanho < MIN_MENSAGEM) return `Escreva pelo menos ${MIN_MENSAGEM} caracteres.`;
  if (tamanho > MAX_MENSAGEM) return `Passou de ${milhar(MAX_MENSAGEM)} caracteres. Corte um pouco.`;
}

const PREFIXO_CAFE = "/cafes/";

/**
 * A página de onde a pessoa veio (`?de=`), se for uma que o link do rodapé
 * gera: a home (`/`) ou um café (`/cafes/{slug}`), sem query nem hash. Tudo o
 * mais — URL externa, `//host`, `..`, outra rota — vira `null`.
 */
export function origemSegura(valor: unknown): string | null {
  if (valor === "/") return "/";
  if (typeof valor !== "string" || !valor.startsWith(PREFIXO_CAFE)) return null;
  const slug = valor.slice(PREFIXO_CAFE.length);
  return slug.length <= MAX_SLUG && SLUG.test(slug) ? valor : null;
}

/**
 * Valida e normaliza o que veio do formulário. O honeypot (`site`, campo que
 * pessoa nenhuma vê) preenchido marca robô: quem chama finge sucesso.
 */
export function validarSugestao(campos: CamposSugestao): ResultadoSugestao {
  if (typeof campos.site === "string" && campos.site !== "") return { ok: false, robo: true };

  const mensagem = normalizarMensagem(typeof campos.mensagem === "string" ? campos.mensagem : "");
  const erros: ErrosSugestao = {};
  if (!ehTipoSugestao(campos.tipo)) erros.tipo = "Escolha o tipo da mensagem.";
  const erro = erroDaMensagem(mensagem);
  if (erro) erros.mensagem = erro;
  if (!ehTipoSugestao(campos.tipo) || erro) return { ok: false, erros };

  return { ok: true, dados: { tipo: campos.tipo, mensagem, origem: origemSegura(campos.origem) } };
}

/**
 * Hash do IP para o limite de envios: HMAC-SHA-256 com segredo, em hex. Sem o
 * segredo, não dá para testar os ~4 bilhões de IPv4 e achar o original. Web
 * Crypto (global no Node e no navegador), para este módulo seguir importável
 * pelo formulário.
 */
export async function hashDoIp(ip: string, segredo: string): Promise<string> {
  const codificar = (texto: string) => new TextEncoder().encode(texto);
  const chave = await crypto.subtle.importKey("raw", codificar(segredo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, codificar(ip));
  return Array.from(new Uint8Array(assinatura), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
