/**
 * Dados editáveis de um café no admin (#48) — sem React, sem Supabase: o
 * formulário (no navegador) e a Server Action aplicam as mesmas regras, e a do
 * servidor é a que vale. Espelha as constraints da tabela `cafes`.
 */

import type { Cafe, Cidade, DiaSemana, FaixaPreco } from "./cafe";
import { DIAS_DA_SEMANA, FECHADO, isRegistro } from "./cafe-hours";
import { SLUGS_ANTIGOS } from "./slugs-antigos.mjs";

const TURNO = /^(\d{2}:\d{2}) – (\d{2}:\d{2})$/;
const HORA = /^(\d{2}):(\d{2})$/;
const DIA_EM_MINUTOS = 24 * 60;

/** "24:00": fim do dia, só como fechamento (café 24 horas: "00:00 – 24:00"). */
const FIM_DO_DIA = "24:00";

/** Turnos por dia: o formulário oferece até 3 (o máximo no seed é 2). */
export const MAX_TURNOS = 3;

/** Texto do dia → turnos `[_, abre, fecha]`, ou `null` se algum sai do formato. */
function lerTurnos(valor: unknown): RegExpExecArray[] | null {
  if (typeof valor !== "string") return null;
  const turnos = valor.split(", ").map((turno) => TURNO.exec(turno));
  return turnos.every((turno) => turno !== null) ? (turnos as RegExpExecArray[]) : null;
}

/** "HH:MM" → minutos desde 00:00, ou `null` se a hora não existe. */
function minutos(hora: string): number | null {
  if (hora === FIM_DO_DIA) return DIA_EM_MINUTOS;
  const [, h, m] = HORA.exec(hora) ?? [];
  if (h === undefined || Number(h) > 23 || Number(m) > 59) return null;
  return Number(h) * 60 + Number(m);
}

/**
 * "Fechado" ou turnos "HH:MM – HH:MM" separados por ", ", em ordem e sem
 * sobreposição: mensagem do problema ou `null`. Só o último turno pode virar a
 * meia-noite (`14:00 – 00:00`).
 */
export function validarHorarioDia(valor: unknown): string | null {
  if (valor === FECHADO) return null;
  // Turno do formulário com um dos `<input type="time">` em branco: " – 18:00".
  if (typeof valor === "string" && valor.split(", ").some((turno) => /^\s*–|–\s*$/.test(turno))) {
    return "Preencha a abertura e o fechamento de cada turno.";
  }
  const turnos = lerTurnos(valor);
  if (!turnos) return "Use o formato 08:00 – 18:00, ou marque Fechado.";
  if (turnos.length > MAX_TURNOS) return `Use até ${MAX_TURNOS} turnos por dia.`;

  let fimAnterior = -1;
  for (let i = 0; i < turnos.length; i++) {
    const abre = turnos[i][1] === FIM_DO_DIA ? null : minutos(turnos[i][1]);
    const fecha = minutos(turnos[i][2]);
    if (abre === null || fecha === null) return "Hora inválida.";
    if (abre === fecha) return "O turno precisa fechar depois de abrir.";

    const viraMeiaNoite = fecha < abre;
    if (abre < fimAnterior || (viraMeiaNoite && i < turnos.length - 1)) {
      return "Os turnos precisam estar em ordem e sem sobreposição.";
    }
    fimAnterior = viraMeiaNoite ? fecha + DIA_EM_MINUTOS : fecha;
  }
  return null;
}

export type Turno = { abre: string; fecha: string };

/** Horário de um dia como o formulário edita: "Fechado" ou turnos com dois `<input type="time">`. */
export type HorarioDia = { fechado: boolean; turnos: Turno[] };

const TURNO_VAZIO: Turno = { abre: "", fecha: "" };

/** Texto do banco → turnos. Valor fora do formato vira um turno vazio, para preencher de novo. */
export function turnosDoHorario(valor: unknown): HorarioDia {
  if (valor === FECHADO) return { fechado: true, turnos: [{ ...TURNO_VAZIO }] };
  const turnos = lerTurnos(valor);
  if (!turnos) return { fechado: false, turnos: [{ ...TURNO_VAZIO }] };
  // O `<input type="time">` não tem 24:00: no formulário, fechar à meia-noite é 00:00.
  return {
    fechado: false,
    turnos: turnos.map(([, abre, fecha]) => ({ abre, fecha: fecha === FIM_DO_DIA ? "00:00" : fecha })),
  };
}

/** Turnos → texto do banco. Não valida: o resultado passa por `validarHorarioDia`. */
export function horarioDosTurnos({ fechado, turnos }: HorarioDia): string {
  if (fechado) return FECHADO;
  // "00:00 – 00:00" é o dia inteiro, gravado como no seed: "00:00 – 24:00".
  return turnos
    .map(({ abre, fecha }) => `${abre} – ${abre === "00:00" && fecha === "00:00" ? FIM_DO_DIA : fecha}`)
    .join(", ");
}

type Normalizado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const textoAparado = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

const USUARIO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;
const HOSTS_INSTAGRAM = ["instagram.com", "www.instagram.com"];

/**
 * `@usuario`, `usuario` ou o link do perfil → `https://instagram.com/usuario`;
 * vazio → `null`. O valor vira o `href` de "Ver no Instagram": outro site,
 * post ou `javascript:` são recusados.
 */
export function normalizarInstagram(valor: unknown): Normalizado<string | null> {
  const texto = textoAparado(valor);
  if (!texto) return { ok: true, valor: null };

  const usuario = texto.startsWith("@") ? texto.slice(1) : usuarioDaUrl(texto);
  if (usuario && USUARIO_INSTAGRAM.test(usuario)) return { ok: true, valor: `https://instagram.com/${usuario}` };
  return { ok: false, erro: "Use o @ ou o link do perfil no Instagram." };
}

function usuarioDaUrl(texto: string): string | null {
  if (USUARIO_INSTAGRAM.test(texto)) return texto;
  const url = lerUrl(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  if (!url || !["http:", "https:"].includes(url.protocol) || !HOSTS_INSTAGRAM.includes(url.hostname)) return null;
  const partes = url.pathname.split("/").filter(Boolean);
  return partes.length === 1 ? partes[0] : null;
}

/**
 * Telefone com DDD → `(81) 3071-6834` (fixo, 10 dígitos) ou `(81) 99908-4986`
 * (celular, 11 dígitos começando com 9); vazio → `null`. Só os dígitos contam.
 */
export function normalizarTelefone(valor: unknown): Normalizado<string | null> {
  const texto = textoAparado(valor);
  if (!texto) return { ok: true, valor: null };

  const [, ddd, prefixo, sufixo] = /^([1-9]\d)(9\d{4}|[2-8]\d{3})(\d{4})$/.exec(texto.replace(/\D/g, "")) ?? [];
  if (!ddd) return { ok: false, erro: "Use DDD e número, ex.: (81) 99999-9999." };
  return { ok: true, valor: `(${ddd}) ${prefixo}-${sufixo}` };
}

export type Coordenadas = { lat: number; lng: number };

/** Número digitado, com vírgula ou ponto decimal (`-8,0631`), ou `null`. */
export function lerNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = textoAparado(valor).replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  return Number(texto);
}

const DECIMAL = String.raw`-?\d+\.\d+`;
const NUMERO = String.raw`-?\d+(?:[.,]\d+)?`;

/**
 * Par colado no campo de latitude — o que o Google Maps copia (`-8.0631, -34.8711`).
 * Com vírgula entre os dois, os números precisam de ponto decimal (senão
 * `-8,0631` viraria um par); com `;`, vale vírgula decimal.
 */
export function parDeCoordenadas(texto: string): Coordenadas | null {
  const [, a, b] =
    new RegExp(`^\\s*(${DECIMAL})\\s*,\\s*(${DECIMAL})\\s*$`).exec(texto) ??
    new RegExp(`^\\s*(${NUMERO})\\s*;\\s*(${NUMERO})\\s*$`).exec(texto) ??
    [];
  if (a === undefined) return null;
  return { lat: lerNumero(a)!, lng: lerNumero(b)! };
}

/**
 * Coordenadas na URL completa do Google Maps. O ponto do lugar (`!3d…!4d…`)
 * vem antes do centro da tela (`@lat,lng`), que fica deslocado do pin; o
 * `?q=lat,lng` é o formato dos links antigos. Formato sem contrato: se o
 * Google mudar, dá `null` e a administradora preenche à mão.
 */
export function coordenadasDaUrl(url: string): Coordenadas | null {
  const alvo = lerUrl(url);
  if (!alvo) return null;
  let caminho: string;
  try {
    caminho = decodeURIComponent(alvo.pathname);
  } catch {
    return null; // `%` malformado
  }
  const [, lat, lng] =
    new RegExp(`!3d(${DECIMAL})!4d(${DECIMAL})`).exec(caminho) ??
    new RegExp(`/@(${DECIMAL}),(${DECIMAL})`).exec(caminho) ??
    new RegExp(`^(${DECIMAL}),\\s*(${DECIMAL})$`).exec(alvo.searchParams.get("q") ?? "") ??
    [];
  return lat === undefined ? null : { lat: Number(lat), lng: Number(lng) };
}

function lerUrl(texto: string): URL | null {
  try {
    return new URL(texto);
  } catch {
    return null;
  }
}

/** Link de compartilhar tem ~40 caracteres; a URL completa, umas centenas. */
const MAX_LINK = 2048;

/** Hosts que são só do Maps (qualquer caminho) e hosts do Google em que só `/maps` vale. */
const HOSTS_MAPS = ["maps.app.goo.gl", "maps.google.com", "maps.google.com.br"];
const HOSTS_GOOGLE = ["google.com", "www.google.com", "google.com.br", "www.google.com.br"];

/**
 * Link que o servidor pode seguir para achar as coordenadas: só `https`, só
 * hosts do Google Maps — conferido a cada redirect, para a Server Action não
 * virar um proxy para qualquer endereço (SSRF).
 */
export function ehLinkDoMaps(url: string): boolean {
  const alvo = url.length <= MAX_LINK ? lerUrl(url) : null;
  if (!alvo || alvo.protocol !== "https:" || alvo.username || alvo.password || alvo.port) return false;

  const { hostname, pathname } = alvo;
  if (HOSTS_MAPS.includes(hostname)) return true;
  if (hostname === "goo.gl") return pathname.startsWith("/maps/");
  return HOSTS_GOOGLE.includes(hostname) && (pathname === "/maps" || pathname.startsWith("/maps/"));
}

/** Texto → slug kebab-case, sem acento: "Casa Forte" → "casa-forte", "Graças" → "gracas". */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG = 80;

/**
 * Slug de um café novo — o endereço `/cafes/<slug>`. Depois de criado, não muda
 * (quebraria links compartilhados). Repetido, só o banco sabe (`unique`).
 */
export function validarSlug(valor: unknown): Normalizado<string> {
  const slug = textoAparado(valor);
  if (!slug) return { ok: false, erro: "Informe o endereço do café no site." };
  if (slug.length > MAX_SLUG) return { ok: false, erro: `Use até ${MAX_SLUG} caracteres.` };
  if (!SLUG.test(slug)) return { ok: false, erro: "Use só letras minúsculas, números e hífens, ex.: cafe-do-bairro." };
  if (SLUGS_ANTIGOS.some(({ de }) => de === slug)) {
    return { ok: false, erro: "Esse endereço já leva a outro café. Escolha outro." };
  }
  return { ok: true, valor: slug };
}

export const CIDADES = ["Recife", "Olinda", "Jaboatão dos Guararapes"] as const satisfies readonly Cidade[];
export const FAIXAS = ["$", "$$", "$$$"] as const satisfies readonly FaixaPreco[];

/**
 * Onde um café pode estar: Recife, Olinda e Jaboatão. Pega lat e lng trocados
 * ou o sinal esquecido — o pin iria parar no oceano. O teste do seed usa a mesma caixa.
 */
export const REGIAO = { lat: { min: -8.2, max: -7.95 }, lng: { min: -35.05, max: -34.8 } } as const;

export function dentroDaRegiao({ lat, lng }: Coordenadas): boolean {
  return lat > REGIAO.lat.min && lat < REGIAO.lat.max && lng > REGIAO.lng.min && lng < REGIAO.lng.max;
}

/** O que o admin grava em `cafes`: o café sem `id`, `slug` (bloqueado), `fotos` (trigger) e `ativo` (seção Status). */
export type DadosCafe = Omit<Cafe, "id" | "slug" | "fotos" | "ativo">;

/** Booleanos com checkbox; `tem_ar_condicionado` (três estados) fica à parte. */
export const BOOLEANOS = [
  "selo_ascape",
  "selo_eu_amo_cafe",
  "aceita_pets",
  "tem_estacionamento",
  "permite_coffee_office",
  "acessivel_pcd",
  "opcoes_vegetarianas",
] as const satisfies ReadonlyArray<keyof DadosCafe>;

/** Campo com mensagem de erro própria. O horário erra por dia: `horario.segunda`. */
export type CampoDados =
  | Exclude<keyof DadosCafe, "bairro_slug" | "horario_funcionamento">
  | `horario.${DiaSemana}`
  | "slug";

export type ErrosDados = Partial<Record<CampoDados, string>>;

export type ResultadoDados = { ok: true; valores: DadosCafe } | { ok: false; erros: ErrosDados };

export const MAX_TEXTO = { nome: 100, bairro: 60, endereco: 200 } as const;

const OBRIGATORIO: Record<keyof typeof MAX_TEXTO, string> = {
  nome: "Informe o nome do café.",
  bairro: "Informe o bairro.",
  endereco: "Informe o endereço.",
};

/**
 * Valida e normaliza os dados de um café, como chegam do formulário (ou de um
 * payload qualquer, na Server Action). Chave desconhecida é ignorada; `id`,
 * `slug`, `fotos` e `ativo` nunca passam. `bairro_slug` é derivado do bairro.
 */
export function validarDadosCafe(entrada: unknown): ResultadoDados {
  const campos = isRegistro(entrada) ? entrada : {};
  const erros: ErrosDados = {};

  const texto = {} as Record<keyof typeof MAX_TEXTO, string>;
  for (const campo of Object.keys(MAX_TEXTO) as (keyof typeof MAX_TEXTO)[]) {
    texto[campo] = textoAparado(campos[campo]);
    if (!texto[campo]) erros[campo] = OBRIGATORIO[campo];
    else if (texto[campo].length > MAX_TEXTO[campo]) erros[campo] = `Use até ${MAX_TEXTO[campo]} caracteres.`;
  }
  const bairroSlug = slugify(texto.bairro);
  if (texto.bairro && !bairroSlug) erros.bairro = "Use letras ou números no bairro.";

  const cidade = CIDADES.find((c) => c === campos.cidade);
  if (!cidade) erros.cidade = "Escolha a cidade.";

  const faixa = FAIXAS.find((f) => f === campos.faixa_preco);
  if (!faixa) erros.faixa_preco = "Escolha a faixa de preço.";

  const lat = lerNumero(campos.lat);
  const lng = lerNumero(campos.lng);
  if (lat === null) erros.lat = "Informe a latitude, ex.: -8,0631.";
  if (lng === null) erros.lng = "Informe a longitude, ex.: -34,8711.";
  if (lat !== null && lng !== null && !dentroDaRegiao({ lat, lng })) {
    erros.lat = "Fora de Recife, Olinda e Jaboatão — confira se lat e lng não estão trocados.";
  }

  const booleanos = {} as Record<(typeof BOOLEANOS)[number], boolean>;
  for (const campo of BOOLEANOS) {
    if (typeof campos[campo] !== "boolean") erros[campo] = "Valor inválido.";
    booleanos[campo] = campos[campo] === true;
  }
  const ar = campos.tem_ar_condicionado;
  if (ar !== true && ar !== false && ar !== null) erros.tem_ar_condicionado = "Escolha uma opção.";

  const horarioEntrada = isRegistro(campos.horario_funcionamento) ? campos.horario_funcionamento : {};
  const horario = {} as Record<DiaSemana, string>;
  for (const dia of DIAS_DA_SEMANA) {
    const erro = validarHorarioDia(horarioEntrada[dia]);
    if (erro) erros[`horario.${dia}`] = erro;
    horario[dia] = String(horarioEntrada[dia]);
  }

  const instagram = normalizarInstagram(campos.instagram);
  if (!instagram.ok) erros.instagram = instagram.erro;
  const telefone = normalizarTelefone(campos.telefone);
  if (!telefone.ok) erros.telefone = telefone.erro;

  if (Object.keys(erros).length > 0 || !instagram.ok || !telefone.ok) return { ok: false, erros };
  return {
    ok: true,
    valores: {
      nome: texto.nome,
      bairro: texto.bairro,
      bairro_slug: bairroSlug,
      endereco: texto.endereco,
      cidade: cidade!,
      lat: lat!,
      lng: lng!,
      ...booleanos,
      tem_ar_condicionado: ar as boolean | null,
      faixa_preco: faixa!,
      horario_funcionamento: horario,
      instagram: instagram.valor,
      telefone: telefone.valor,
    },
  };
}

/** O que o cadastro (#53) grava: os dados editáveis e o slug, que só se escolhe aqui. */
export type NovoCafe = DadosCafe & { slug: string };

export type ResultadoNovoCafe = { ok: true; valores: NovoCafe } | { ok: false; erros: ErrosDados };

/** `validarDadosCafe` mais o slug, com os erros somados. `id`, `fotos` e `ativo` nunca passam. */
export function validarNovoCafe(entrada: unknown): ResultadoNovoCafe {
  const dados = validarDadosCafe(entrada);
  const slug = validarSlug(isRegistro(entrada) ? entrada.slug : undefined);
  if (dados.ok && slug.ok) return { ok: true, valores: { ...dados.valores, slug: slug.valor } };
  return { ok: false, erros: { ...(dados.ok ? {} : dados.erros), ...(slug.ok ? {} : { slug: slug.erro }) } };
}
