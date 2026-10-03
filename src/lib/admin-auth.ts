/**
 * Regras puras do acesso ao admin — sem Next, sem Supabase: o middleware, a
 * tela de login e o `requireAdmin` aplicam estas decisões.
 */

/** O pedaço das claims do JWT do Supabase que decide o acesso. */
export type AdminClaims = {
  app_metadata?: { role?: unknown } | null;
  aal?: unknown;
};

export type EtapaDoLogin = "senha" | "codigo" | "cadastro-mfa" | "pronto";

export function etapaDoLogin(
  claims: AdminClaims | null,
  { temFatorVerificado = false }: { temFatorVerificado?: boolean } = {},
): EtapaDoLogin {
  if (claims?.app_metadata?.role !== "admin") return "senha";
  if (claims.aal === "aal2") return "pronto";
  return temFatorVerificado ? "codigo" : "cadastro-mfa";
}

const ADMIN = "/admin";
const ORIGEM_FICTICIA = "http://admin.invalid";

/**
 * Para onde mandar depois do login: o `next` da URL, se for uma página do
 * próprio admin; qualquer outra coisa cai em `/admin` (sem open redirect).
 */
export function destinoSeguro(next: unknown): string {
  if (typeof next !== "string" || next.length > 2048) return ADMIN;
  // `//host` e `/\host` o navegador lê como outro domínio.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return ADMIN;

  // Normaliza `..`, `%2e` e afins antes de conferir o caminho.
  const url = new URL(next, ORIGEM_FICTICIA);
  if (url.origin !== ORIGEM_FICTICIA) return ADMIN;
  if (url.pathname !== ADMIN && !url.pathname.startsWith(`${ADMIN}/`)) return ADMIN;
  if (url.pathname.startsWith(`${ADMIN}/login`)) return ADMIN;
  return url.pathname + url.search;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de café válido. Outro texto vira 404 antes da query (o Postgres daria erro 22P02). */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}
