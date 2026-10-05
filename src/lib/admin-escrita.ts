/**
 * Cinto de segurança das Server Actions de escrita do admin (#75) — sem Next,
 * sem Supabase. Não há banco local: o `pnpm dev` e os previews da Vercel falam
 * com o banco de produção. Fora da produção da Vercel, a escrita fica
 * desligada, a menos que liberada de propósito.
 *
 * Não é camada de segurança — quem decide o acesso é a RLS. É proteção contra
 * gravar na produção sem querer, testando uma tela.
 */

export type EscritaDoAdmin = { liberada: true } | { liberada: false; motivo: string };

/** O aviso da faixa do painel e o erro das actions bloqueadas. */
export const MODO_LEITURA = "Modo leitura: a gravação está desligada fora da produção (ADMIN_ESCRITA_LIBERADA=1 libera).";

export function escritaDoAdmin(env: Partial<Record<string, string>> = process.env): EscritaDoAdmin {
  // Valor exato: "true", "0" ou "1 " não liberam — liberar é sempre de propósito.
  if (env.VERCEL_ENV === "production" || env.ADMIN_ESCRITA_LIBERADA === "1") return { liberada: true };
  return { liberada: false, motivo: MODO_LEITURA };
}
