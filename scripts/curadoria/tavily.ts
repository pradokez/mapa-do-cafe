/** Adaptador fino do Tavily (busca e leitura de páginas). Sem teste: casca sobre o `fetch`; a orquestração o testa dublado. */
import { postarJson } from "./http";
import type { PaginaExtraida, ResultadoDeBusca, Tavily } from "./robo";

const API = "https://api.tavily.com";

function lista(valor: unknown): Record<string, unknown>[] {
  const resultados = (valor as { results?: unknown } | null)?.results;
  return Array.isArray(resultados) ? resultados.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null) : [];
}

export function criarTavily(chave: string): Tavily {
  const headers = { authorization: `Bearer ${chave}` };
  return {
    async buscar(consulta): Promise<ResultadoDeBusca[]> {
      const resposta = await postarJson(`${API}/search`, {
        headers,
        corpo: { query: consulta, search_depth: "basic", max_results: 5 },
      });
      return lista(resposta).flatMap((r) =>
        typeof r.url === "string" ? [{ url: r.url, titulo: typeof r.title === "string" ? r.title : r.url, trecho: typeof r.content === "string" ? r.content : "" }] : [],
      );
    },
    async extrair(urls): Promise<PaginaExtraida[]> {
      const resposta = await postarJson(`${API}/extract`, { headers, corpo: { urls, extract_depth: "basic", format: "text" } });
      return lista(resposta).flatMap((r) => (typeof r.url === "string" && typeof r.raw_content === "string" ? [{ url: r.url, texto: r.raw_content }] : []));
    },
  };
}
