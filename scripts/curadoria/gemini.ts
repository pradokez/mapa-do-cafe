/**
 * Adaptador fino do Gemini (extração estruturada, sem Grounding com Google
 * Search — os termos proíbem guardar as fontes). Só vão dados públicos de
 * estabelecimento e o texto de páginas públicas. Sem teste: casca sobre o `fetch`.
 */
import { postarJson } from "./http";
import type { EntradaDoGemini, Gemini } from "./robo";
import { SCHEMA_DA_EXTRACAO, SCHEMA_DOS_CANDIDATOS } from "./schema";

export const MODELO_PADRAO = "gemini-3-flash-preview";
/** Por página, para caber no contexto e na cota de tokens do plano grátis. */
const MAX_CARACTERES_POR_PAGINA = 12_000;

export function promptDaExtracao({ cafe, paginas }: EntradaDoGemini): string {
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
    paginasEmTexto(paginas),
  ].join("\n");
}

function paginasEmTexto(paginas: EntradaDoGemini["paginas"]): string {
  return paginas
    .map((p, i) => `### Página ${i + 1}\nURL: ${p.url}\nTítulo: ${p.titulo}\n${p.texto.slice(0, MAX_CARACTERES_POR_PAGINA)}`)
    .join("\n\n");
}

/** Busca aberta (#189): cafés novos que as páginas de uma consulta citam. */
export function promptDosCandidatos({ consulta, paginas }: { consulta: string; paginas: EntradaDoGemini["paginas"] }): string {
  return [
    `As páginas abaixo vieram da busca "${consulta}". Liste os cafés ESPECIAIS (cafeterias de café de especialidade) que elas citam.`,
    "Regras:",
    "- Use SÓ o que está nas páginas; não use conhecimento próprio nem estime. Dado ausente = null.",
    "- Só cafés em Recife, Olinda ou Jaboatão dos Guararapes (PE). Ignore padaria, rede, lanchonete e café comum.",
    "- Só cafeterias FÍSICAS: um lugar com salão ou balcão onde se toma café. Torrefação, marca de grãos ou loja online sem salão NÃO entram.",
    "- sinais: indícios de café especial (origem do grão, torra própria, métodos filtrados, barista, microlote…), cada um com a URL e um trecho LITERAL da página. Sem indício, lista vazia.",
    "- fontes: as páginas que sustentam os dados de cadastro (endereço, bairro, Instagram, telefone, horário), com a data COMO APARECE na página (null se não houver) e um trecho LITERAL.",
    "- Copie os trechos, não parafraseie. Horário por dia no formato pedido.",
    "",
    paginasEmTexto(paginas),
  ].join("\n");
}

export function criarGemini(chave: string, modelo: string = MODELO_PADRAO): Gemini {
  async function gerar(prompt: string, schema: object): Promise<unknown> {
    const resposta = (await postarJson(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      headers: { "x-goog-api-key": chave },
      timeoutMs: 90_000,
      // Timeout e 429 já custaram um pedido da cota diária (20 no grátis); repetir só gasta outro (#190).
      retentarTimeout: false,
      retentar429: false,
      corpo: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0,
          // Copiar fatos de páginas não pede raciocínio longo; o padrão (alto) passava dos 90 s (#190).
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
    })) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const texto = resposta.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texto !== "string") throw new Error("resposta sem texto");
    return JSON.parse(texto);
  }

  return {
    extrair: (entrada) => gerar(promptDaExtracao(entrada), SCHEMA_DA_EXTRACAO),
    extrairCandidatos: (entrada) => gerar(promptDosCandidatos(entrada), SCHEMA_DOS_CANDIDATOS),
  };
}
