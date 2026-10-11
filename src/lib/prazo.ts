/**
 * Prazo do servidor (#138, PRD #135). **Puro**: o `cafe-repository` desiste
 * das leituras públicas depois dele, e o client pode importar o mesmo valor.
 */

/** Quanto uma leitura pública espera o Supabase — folga para ele acordar da hibernação (passa de 10 s). */
export const PRAZO_DO_SERVIDOR_MS = 20_000;

/** A leitura não respondeu dentro do prazo — distinto de uma falha do banco. */
export class PrazoEsgotado extends Error {
  constructor(
    readonly leitura: string,
    readonly ms: number,
  ) {
    super(`${leitura} não respondeu em ${ms} ms`);
    this.name = "PrazoEsgotado";
  }
}
