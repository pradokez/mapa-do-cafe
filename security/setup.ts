import { readFileSync } from "node:fs";

/**
 * Carrega `.env.security` (raiz, gitignored) no `process.env`, sem depender de
 * `dotenv`. Variável que já exista no ambiente vence o arquivo. Ausência do
 * arquivo não é erro: os testes pulam quando a env falta (ver `env.ts`).
 */
try {
  const texto = readFileSync(new URL("../.env.security", import.meta.url), "utf8");
  for (const linha of texto.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Sem arquivo: segue com o que estiver no ambiente (ou nada, e os testes pulam).
}
