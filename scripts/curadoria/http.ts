/**
 * `fetch` com timeout e uma retentativa curta (429 e 5xx, ou rede), para os
 * adaptadores. O erro nunca leva URL, cabeçalho nem corpo: só o status.
 */
export async function postarJson(
  url: string,
  init: { headers: Record<string, string>; corpo: unknown; timeoutMs?: number; esperaEntreTentativasMs?: number },
): Promise<unknown> {
  const { timeoutMs = 30_000, esperaEntreTentativasMs = 2_000 } = init;
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
        await new Promise((resolve) => setTimeout(resolve, esperaEntreTentativasMs));
        continue;
      }
      throw new Error(`HTTP ${resposta.status}`);
    } catch (erro) {
      const doHttp = erro instanceof Error && erro.message.startsWith("HTTP ");
      if (tentativa === 0 && !doHttp) {
        await new Promise((resolve) => setTimeout(resolve, esperaEntreTentativasMs));
        continue;
      }
      throw doHttp ? erro : new Error("rede ou timeout");
    }
  }
}
