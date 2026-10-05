import "server-only";

import { escritaDoAdmin } from "@/lib/admin-escrita";

/**
 * Modo leitura (#75): a mensagem de erro, se a escrita está desligada neste
 * ambiente, ou `null`. Toda Server Action que grava chama isto logo depois do
 * `requireAdmin()` — `src/lib/fronteiras.test.ts` confere.
 */
export function bloqueioDeEscrita(): string | null {
  const escrita = escritaDoAdmin();
  return escrita.liberada ? null : escrita.motivo;
}
