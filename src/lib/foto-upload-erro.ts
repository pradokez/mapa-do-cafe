/**
 * Falhas do upload de foto do admin (#74) — sem React, sem Supabase: o que deu
 * errado, em que etapa, e a frase que diz o que fazer. As Server Actions
 * devolvem a `Falha` crua (e a registram no log); o formulário a traduz aqui,
 * junto com as falhas do próprio navegador.
 */

import { ERRO_SEM_WEBP, ERRO_WEBP_GRANDE } from "./foto-upload";

export type Etapa = "converter" | "preparar" | "enviar" | "registrar";

export type Falha = {
  etapa: Etapa;
  /** Código do Postgres/PostgREST (`42P01`), do Storage, ou nosso (`sessao`, `rede`…). */
  codigo: string;
  /** Status HTTP, quando houve resposta. */
  status?: number;
  /** Mensagem original do erro, já saneada (`sanear`). */
  original?: string;
  /** Caminho no bucket — só quando o arquivo ficou lá sem registro. */
  caminho?: string;
  /** O registro falhou e a remoção do arquivo também: ficou um órfão no bucket. */
  orfao?: boolean;
};

const NAO_ADIANTA = "Não adianta tentar de novo.";

const MENSAGENS: Record<string, string> = {
  // Antes de subir (navegador).
  offline: "Você está sem internet. A foto não foi enviada. Conecte-se e clique em Enviar foto de novo.",
  // Preparar.
  sessao:
    "Sua sessão expirou e a foto não foi enviada. Entre de novo em outra aba e clique em Enviar foto outra vez — o que você preencheu continua aqui.",
  cafe: "Este café não foi encontrado. Recarregue a página.",
  bucket: `O bucket de fotos não existe no Supabase: falta aplicar a migration. ${NAO_ADIANTA}`,
  permissao:
    "O Storage recusou a permissão para gravar a foto. Saia e entre de novo; se continuar, confira as políticas do bucket — tentar de novo não resolve.",
  indisponivel:
    "O Supabase não respondeu — ele pode estar acordando da hibernação. Espere um minuto e tente de novo.",
  // Enviar.
  "token-expirado":
    "O envio demorou demais e a autorização para subir a foto expirou. Clique em Enviar foto de novo.",
  duplicado:
    "Já existia um arquivo com esse nome no Storage. Clique em Enviar foto de novo — o nome é sorteado a cada envio.",
  "storage-5xx": "O Storage do Supabase falhou ao receber a foto. Tente de novo em instantes.",
  rede: "A conexão caiu durante o envio. Confira a internet e tente de novo.",
  timeout: "O envio passou de 1 minuto sem terminar. Confira a internet e tente de novo.",
  // O bucket recusou o que o cliente já deveria ter barrado: a mesma frase do cliente.
  "413": ERRO_WEBP_GRANDE,
  "415": ERRO_SEM_WEBP,
  // Registrar.
  "sem-arquivo": "A foto não chegou ao Storage, embora o envio tenha respondido. Tente de novo.",
  exists:
    "Não deu para conferir se a foto chegou ao Storage — o Supabase não respondeu. Tente de novo em instantes.",
  "42P01": `A tabela de fotos não existe no banco: falta aplicar a migration em produção. ${NAO_ADIANTA}`,
  "42501": "O banco recusou a gravação: a sessão perdeu o acesso de admin. Entre de novo e envie outra vez.",
  "23505": "Esta foto já estava registrada. Recarregue a página para conferir.",
  "23503": "O café não existe mais no banco. Recarregue a página.",
  "23514": `O banco recusou os dados da autorização (origem, nome ou data) — o formulário e o banco divergem. ${NAO_ADIANTA}`,
  P0001: `Um gatilho do banco recusou a foto. Algo está errado no banco: ${NAO_ADIANTA.toLowerCase()}`,
  "sem-resposta":
    "O registro não respondeu (a conexão pode ter caído). A foto pode ou não ter entrado: recarregue a página e confira a lista antes de enviar de novo.",
};
// O PostgREST diz "tabela fora do cache do schema" — na prática, a mesma migration faltando.
MENSAGENS.PGRST205 = MENSAGENS["42P01"];

export const MENSAGEM_GENERICA = "Não deu para enviar a foto agora. Tente de novo em instantes.";
const ORFAO = "O arquivo ficou no Storage sem registro (órfão); o caminho está nos detalhes.";

/** Frase principal (o que houve e o que fazer) e as linhas de "Detalhes técnicos". */
export function mensagemDaFalha(falha: Falha): { mensagem: string; detalhes: string[] } {
  const causa = MENSAGENS[falha.codigo] ?? MENSAGEM_GENERICA;
  const mensagem = falha.orfao ? `${causa} ${ORFAO}` : causa;

  const detalhes = [`Etapa: ${falha.etapa}`, `Código: ${falha.codigo}`];
  if (falha.status !== undefined) detalhes.push(`HTTP: ${falha.status}`);
  if (falha.original) detalhes.push(`Mensagem: ${falha.original}`);
  if (falha.orfao && falha.caminho) detalhes.push(`Caminho: ${falha.caminho}`);
  return { mensagem, detalhes };
}

const MAX_ORIGINAL = 300;

/**
 * Mensagem original pronta para os detalhes e o log: sem URL (a assinada leva
 * o token na query) nem `token=…`, e curta.
 */
export function sanear(texto: unknown): string | undefined {
  if (typeof texto !== "string") return undefined;
  const limpo = texto
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/token=\S+/gi, "token=[…]")
    .replace(/eyJ[\w-]+(\.[\w-]+)*/g, "[jwt]")
    .trim();
  return limpo.slice(0, MAX_ORIGINAL) || undefined;
}

const campo = (erro: unknown, chave: string): unknown =>
  erro !== null && typeof erro === "object" ? (erro as Record<string, unknown>)[chave] : undefined;

/** Erro do PostgREST no insert: o código do Postgres (ou do PostgREST) é a causa. */
export function falhaDoPostgres(erro: unknown): Falha {
  const code = campo(erro, "code");
  return {
    etapa: "registrar",
    codigo: typeof code === "string" && code ? code : "desconhecido",
    original: sanear(campo(erro, "message")),
  };
}

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const numero = (valor: unknown) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * O Storage responde quase tudo com HTTP 400 e o status "de verdade" no
 * `statusCode` do corpo (`"404"` para bucket inexistente, `"403"` para a
 * política). A mensagem original leva os dois quando divergem.
 */
function originalDoStorage(mensagem: string, status?: number, statusCode?: number) {
  const sufixo = statusCode !== undefined && statusCode !== status ? ` (statusCode ${statusCode})` : "";
  return sanear(`${mensagem}${sufixo}`);
}

const POLITICA = /row-level security|unauthorized|forbidden|permission/i;

/** Causa comum a toda resposta do Storage, pelo status efetivo e pela mensagem. */
function causaDoStorage(efetivo: number | undefined, mensagem: string): string {
  if (efetivo === undefined || efetivo >= 500) return "indisponivel";
  if (/bucket not found/i.test(mensagem)) return "bucket";
  if (efetivo === 403 || POLITICA.test(mensagem)) return "permissao";
  return "desconhecido";
}

/** Erro do storage-js (`StorageApiError` ou, sem resposta HTTP, `StorageUnknownError`). */
export function falhaDoStorage(etapa: Etapa, erro: unknown): Falha {
  const status = numero(campo(erro, "status"));
  const statusCode = numero(campo(erro, "statusCode"));
  const mensagem = texto(campo(erro, "message")) || texto(campo(erro, "error"));
  const falha: Falha = { etapa, codigo: causaDoStorage(statusCode ?? status, mensagem) };
  if (status !== undefined) falha.status = status;
  const original = originalDoStorage(mensagem, status, statusCode);
  if (original) falha.original = original;
  return falha;
}

const TOKEN = /jwt|"exp"|signature|token/i;

/**
 * Resposta não-ok ao `PUT` na URL assinada. O corpo é o JSON do Storage
 * (`statusCode`, `error`, `message`), quando veio. Token vencido ou inválido
 * também chega como 400/403: quem separa da política é a mensagem.
 */
export function falhaDoPut(status: number, corpo: unknown): Falha {
  const statusCode = numero(campo(corpo, "statusCode"));
  const efetivo = statusCode ?? status;
  const erro = texto(campo(corpo, "error"));
  const mensagem = texto(campo(corpo, "message"));
  const tudo = `${erro} ${mensagem}`;

  let codigo: string;
  if (efetivo === 413 || efetivo === 415) codigo = String(efetivo);
  else if (efetivo === 409) codigo = "duplicado";
  else if (efetivo >= 500) codigo = "storage-5xx";
  else if ([400, 401, 403].includes(efetivo) && TOKEN.test(tudo)) codigo = "token-expirado";
  else if (efetivo === 403 || POLITICA.test(tudo)) codigo = "permissao";
  else codigo = "desconhecido";

  const falha: Falha = { etapa: "enviar", codigo, status };
  const original = sanear([erro, mensagem].filter(Boolean).join(": "));
  if (original) falha.original = original;
  return falha;
}

/** O `fetch` (ou a Server Action) rejeitou: sem resposta. `AbortSignal.timeout` rejeita com `TimeoutError`. */
export function falhaDeRede(etapa: Etapa, erro: unknown): Falha {
  const falha: Falha = { etapa, codigo: campo(erro, "name") === "TimeoutError" ? "timeout" : "rede" };
  const original = sanear(campo(erro, "message"));
  if (original) falha.original = original;
  return falha;
}
