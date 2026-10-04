/**
 * Gating da suíte de exploit (#59): decide o que pode rodar, e contra qual
 * projeto. A regra dura é: **nada é escrito em produção**. A escrita só libera
 * contra o projeto descartável, e com a secret key dele (para criar usuários de
 * teste e conferir o banco por fora da RLS).
 */

/**
 * O ref do projeto de produção. Se a URL de teste for esta, escrita é proibida.
 * Não é segredo (a proteção de produção é a RLS + chave publishable pública +
 * signup desligado, tudo comprovado no pentest); fica aqui, mesmo em repo
 * público, como cinto de segurança contra escrever em produção por engano.
 */
export const PROD_REF = "jazbgmkscobpbffsmtes";

export const SUPABASE_URL = process.env.SECURITY_SUPABASE_URL ?? "";
export const PUBLISHABLE_KEY = process.env.SECURITY_PUBLISHABLE_KEY ?? "";
export const SECRET_KEY = process.env.SECURITY_SECRET_KEY ?? "";
export const APP_URL = process.env.SECURITY_APP_URL ?? "";

/** Leitura/negação precisam só de URL + publishable. */
export const PODE_LER = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

const EH_PRODUCAO = SUPABASE_URL.includes(PROD_REF);

/**
 * Escrita (criar usuário, insert/update/upload) só no descartável: secret key
 * presente **e** URL que não é a de produção. A dupla trava é de propósito —
 * nem um `.env.security` apontado para produção por engano escreve lá.
 */
export const PODE_ESCREVER = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SECRET_KEY) && !EH_PRODUCAO;

export const motivoSemLeitura = "defina SECURITY_SUPABASE_URL e SECURITY_PUBLISHABLE_KEY (ver .env.example)";
export const motivoSemEscrita = EH_PRODUCAO
  ? "SECURITY_SUPABASE_URL aponta para produção: escrita bloqueada, use o projeto descartável"
  : "defina SECURITY_SECRET_KEY do projeto descartável para os testes que escrevem";
