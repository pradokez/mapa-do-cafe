/**
 * URL absoluta http(s). Barra `javascript:`, `data:` e caminhos relativos em
 * dado que vira `href`/`src` — o banco aceita qualquer texto.
 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
