/**
 * Adaptador fino do Gemini (extração estruturada, sem Grounding com Google
 * Search — os termos proíbem guardar as fontes). Só vão dados públicos de
 * estabelecimento e o texto de páginas públicas. Sem teste: casca sobre o `fetch`.
 */
import { postarJson } from "./http";
import type { EntradaDoGemini, Gemini } from "./robo";
import { SCHEMA_DA_EXTRACAO } from "./schema";

export const MODELO_PADRAO = "gemini-3-flash-preview";
/** Por página, para caber no contexto e na cota de tokens do plano grátis. */
const MAX_CARACTERES_POR_PAGINA = 12_000;

export function promptDaExtracao({ cafe, paginas }: EntradaDoGemini): string {
  const fontes = paginas
    .map((p, i) => `### Página ${i + 1}\nURL: ${p.url}\nTítulo: ${p.titulo}\n${p.texto.slice(0, MAX_CARACTERES_POR_PAGINA)}`)
    .join("\n\n");
  return [
    `Você extrai fatos sobre o café "${cafe.nome}" (${cafe.bairro}, ${cafe.cidade}) das páginas abaixo.`,
    "Regras:",
    "- Use SÓ o que está nas páginas; não use conhecimento próprio nem estime.",
    "- Cada fato leva a URL da página, o título, a data COMO APARECE na página (null se não houver) e um trecho LITERAL que sustenta o fato (e a data).",
    "- Se as páginas discordam, devolva todos os fatos, sem escolher.",
    "- Ignore páginas que são de outro estabelecimento. Lista vazia quando não há o fato.",
    "- Booleanos (aceita_pets, tem_estacionamento, permite_coffee_office, acessivel_pcd, opcoes_vegetarianas, tem_ar_condicionado): negacao_explicita só quando a página diz que NÃO tem.",
    "- Situação: 'permanente' só para fechado definitivamente; 'temporaria' para reforma, férias etc.",
    "",
    fontes,
  ].join("\n");
}

export function criarGemini(chave: string, modelo: string = MODELO_PADRAO): Gemini {
  return {
    async extrair(entrada) {
      const resposta = (await postarJson(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        headers: { "x-goog-api-key": chave },
        timeoutMs: 90_000,
        corpo: {
          contents: [{ parts: [{ text: promptDaExtracao(entrada) }] }],
          generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA_DA_EXTRACAO, temperature: 0 },
        },
      })) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
      const texto = resposta.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof texto !== "string") throw new Error("resposta sem texto");
      return JSON.parse(texto);
    },
  };
}
