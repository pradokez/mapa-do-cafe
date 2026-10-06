/**
 * Sugestões do público (#83): tipos, limites, normalização do texto e
 * validação — comuns ao formulário e à Server Action. Puro: não importa React
 * nem Supabase. O limite de 5 envios por IP na hora não mora aqui: quem conta
 * é a função `enviar_sugestao`, no banco.
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

/** Número com separador de milhar ("1.200"). */
export const milhar = (n: number) => n.toLocaleString("pt-BR");

/** Contador abaixo do campo: "1.998 restantes" ou, acima do limite, "12 a mais". */
export function contadorDaMensagem(texto: string): { rotulo: string; restantes: number } {
  const restantes = MAX_MENSAGEM - tamanhoDaMensagem(normalizarMensagem(texto));
  if (restantes < 0) return { rotulo: `${milhar(-restantes)} a mais`, restantes };
  return { rotulo: `${milhar(restantes)} ${restantes === 1 ? "restante" : "restantes"}`, restantes };
}

/** Erro de texto longo demais — o formulário o mostra já ao passar do limite, sem esperar o envio. */
export const ERRO_MENSAGEM_LONGA = `Passou de ${milhar(MAX_MENSAGEM)} caracteres. Corte um pouco.`;

function erroDaMensagem(normalizada: string): string | undefined {
  const tamanho = tamanhoDaMensagem(normalizada);
  if (tamanho === 0) return "Escreva sua mensagem.";
  if (tamanho < MIN_MENSAGEM) return `Escreva pelo menos ${MIN_MENSAGEM} caracteres.`;
  if (tamanho > MAX_MENSAGEM) return ERRO_MENSAGEM_LONGA;
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

/**
 * Resultado de um envio, como o formulário o recebe (`useFormState`). Leva o
 * que foi enviado, para o formulário voltar preenchido no erro e no limite —
 * inclusive sem JS, quando a página é renderizada de novo pelo servidor.
 */
export type EnvioSugestao = {
  status: "inicial" | "erro" | "limite" | "falha" | "enviado";
  erros: ErrosSugestao;
  valores: { tipo: string; mensagem: string };
};

export const ENVIO_INICIAL: EnvioSugestao = { status: "inicial", erros: {}, valores: { tipo: "", mensagem: "" } };

/** Triagem no admin (#84): a mensagem não muda, só o status. */
export const STATUS_SUGESTAO = ["nova", "lida", "arquivada"] as const;
export type StatusSugestao = (typeof STATUS_SUGESTAO)[number];

export function ehStatusSugestao(valor: unknown): valor is StatusSugestao {
  return STATUS_SUGESTAO.includes(valor as StatusSugestao);
}

/** Arquivadas ficam escondidas até alguém pedir. */
export const FILTRO_PADRAO: StatusSugestao[] = ["nova", "lida"];

/**
 * O filtro de `/admin/sugestoes` a partir do `?status=` (`nova,lida`): status
 * desconhecido é ignorado, e sem nenhum válido vale o padrão. Sempre na ordem
 * dos chips, para a URL de um mesmo filtro ser uma só.
 */
export function statusDoFiltro(param: string | string[] | undefined): StatusSugestao[] {
  const pedidos = ([param].flat()[0] ?? "").split(",");
  const status = STATUS_SUGESTAO.filter((s) => pedidos.includes(s));
  return status.length > 0 ? status : FILTRO_PADRAO;
}

/**
 * O filtro que um chip aplica ao ser clicado: liga ou desliga aquele status.
 * O último ligado não desliga — um filtro vazio cairia no padrão, e o clique
 * pareceria fazer o contrário.
 */
export function alternarStatus(atuais: readonly StatusSugestao[], status: StatusSugestao): StatusSugestao[] {
  const ligado = atuais.includes(status);
  if (ligado && atuais.length === 1) return [...atuais];
  return STATUS_SUGESTAO.filter((s) => (s === status ? !ligado : atuais.includes(s)));
}

export type AcaoDeStatus = { rotulo: string; para: StatusSugestao };

const ARQUIVAR: AcaoDeStatus = { rotulo: "Arquivar", para: "arquivada" };

/** Botões de cada sugestão, conforme o status (design 3b). Desarquivar volta a "lida", não a "nova". */
export function acoesDoStatus(status: StatusSugestao): AcaoDeStatus[] {
  if (status === "nova") return [{ rotulo: "Marcar como lida", para: "lida" }, ARQUIVAR];
  if (status === "lida") return [{ rotulo: "Voltar para nova", para: "nova" }, ARQUIVAR];
  return [{ rotulo: "Desarquivar", para: "lida" }];
}

// Partes numéricas da data em Recife (a Vercel roda em UTC). O mês sai da
// lista abaixo, não do `Intl` em pt-BR, que escreve "out." com ponto.
const partesEmRecife = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const UM_DIA = 24 * 60 * 60 * 1000;

function emRecife(data: Date) {
  const partes = Object.fromEntries(partesEmRecife.formatToParts(data).map((p) => [p.type, p.value]));
  return {
    dia: `${partes.year}-${partes.month}-${partes.day}`,
    ano: partes.year,
    rotulo: `${partes.day} ${MESES[Number(partes.month) - 1]}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

/**
 * Quando a sugestão chegou, no fuso de Recife: "Hoje, 14:32", "Ontem, 21:07",
 * "3 out, 08:15" — e com o ano se não for o corrente ("3 out 2025, 08:15").
 */
export function formatarDataDaSugestao(iso: string, agora: Date): string {
  const data = emRecife(new Date(iso));
  const hoje = emRecife(agora);
  // Recife não tem horário de verão: o dia anterior está sempre 24 h atrás.
  if (data.dia === hoje.dia) return `Hoje, ${data.hora}`;
  if (data.dia === emRecife(new Date(agora.getTime() - UM_DIA)).dia) return `Ontem, ${data.hora}`;
  const ano = data.ano === hoje.ano ? "" : ` ${data.ano}`;
  return `${data.rotulo}${ano}, ${data.hora}`;
}

/** "1 sugestão nova" / "N sugestões novas" — o cartão do topo do `/admin`. */
export function rotuloDeNovas(n: number): string {
  return n === 1 ? "1 sugestão nova" : `${milhar(n)} sugestões novas`;
}

export const ROTULO_STATUS: Record<StatusSugestao, string> = { nova: "Nova", lida: "Lida", arquivada: "Arquivada" };

/** Uma linha de `sugestoes`, como o admin a lê (`listSugestoes`). */
export type Sugestao = {
  id: string;
  tipo: TipoSugestao;
  mensagem: string;
  origem: string | null;
  status: StatusSugestao;
  criado_em: string;
};

export type ContagemDeSugestoes = Record<StatusSugestao, number>;

/**
 * Resultado de `mudarStatusSugestao` (`useFormState`). Aqui, e não na action:
 * arquivo `"use server"` só exporta funções.
 */
export type MudancaDeStatus = { ok: true; id: string; status: StatusSugestao } | { ok: false; erro: string } | null;
