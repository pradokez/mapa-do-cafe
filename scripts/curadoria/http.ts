/**
 * `fetch` com timeout e uma retentativa curta (429 e 5xx, ou rede), para os
 * adaptadores. O erro nunca leva URL, cabeçalho nem corpo: só `HTTP <status>`,
 * `timeout` ou `rede` (o robô os mostra no log). Timeout só se repete com
 * `retentarTimeout`: quem demorou uma vez costuma demorar de novo.
 */
const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function postarJson(
  url: string,
  init: { headers: Record<string, string>; corpo: unknown; timeoutMs?: number; esperaEntreTentativasMs?: number; retentarTimeout?: boolean },
): Promise<unknown> {
  const { timeoutMs = 30_000, esperaEntreTentativasMs = 2_000, retentarTimeout = true } = init;
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      const resposta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...init.headers },
        body: JSON.stringify(init.corpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resposta.ok) return await resposta.json();
      if (tentativa === 0 && (resposta.status === 429 || resposta.status >= 500)) {
        await esperar(esperaEntreTentativasMs);
        continue;
      }
      throw new Error(`HTTP ${resposta.status}`);
    } catch (erro) {
      const doHttp = erro instanceof Error && erro.message.startsWith("HTTP ");
      const timeout = erro instanceof Error && erro.name === "TimeoutError";
      if (tentativa === 0 && !doHttp && (!timeout || retentarTimeout)) {
        await esperar(esperaEntreTentativasMs);
        continue;
      }
      throw doHttp ? erro : new Error(timeout ? "timeout" : "rede");
    }
  }
}
