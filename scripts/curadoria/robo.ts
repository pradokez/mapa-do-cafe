/**
 * Rodada do robô de curadoria (#185, PRD #167): verifica os cafés do rodízio
 * da semana e registra o que difere do banco como revisão pendente. Pesquisa e
 * propõe; nunca publica. Tavily, Gemini e RPC entram por parâmetro — o teste
 * os dubla, e a rede fica nos adaptadores.
 *
 * Log: só códigos e contagens. Nunca chave, segredo, mensagem de terceiros nem
 * corpo de página.
 */
import type { Cafe } from "../../src/lib/cafe";
import { atualidadeDasFontes } from "../../src/lib/revisao-atualidade";
import { trechoExisteNaPagina } from "../../src/lib/revisao-fontes";
import { proporRevisoes, type Proposta, type Rejeitada } from "../../src/lib/revisao-proposta";
import { rodizio } from "../../src/lib/rodizio";
import { aFatos, lerExtracao, type Extracao } from "./schema";

/** Teto por rodada (#181): ~30% da cota mensal do Tavily; 2 a menos que os 20/dia do Gemini grátis. */
export const LIMITES_PADRAO = { creditosTavily: 70, chamadasGemini: 18 } as const;
/** 5 por minuto no Gemini grátis = uma a cada 12 s; 15 s de folga. */
export const PAUSA_ENTRE_CHAMADAS_MS = 15_000;
/** Páginas lidas por café e quantas o Extract cobra por crédito. */
export const PAGINAS_POR_CAFE = 5;
const PAGINAS_POR_CREDITO = 5;
/** Um café custa no máximo 1 busca + 1 extract. */
const CREDITOS_POR_CAFE = 2;
/** O `erro` da rodada cabe em 80 caracteres no banco. */
const MAX_ERRO = 80;

/** Redes que o robots.txt fecha a robôs: nunca vão ao Extract, só entram com o trecho da busca (#181). */
const HOSTS_SEM_EXTRACT = ["instagram.com", "facebook.com", "fb.com"];

export function podeExtrair(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !HOSTS_SEM_EXTRACT.some((bloqueado) => host === bloqueado || host.endsWith(`.${bloqueado}`));
  } catch {
    return false;
  }
}

/** Um café como a RPC `curadoria_contexto` o devolve. */
export type CafeDoContexto = Pick<Cafe, "id" | "nome" | "bairro" | "cidade" | "ativo"> &
  Partial<Omit<Cafe, "id" | "nome" | "bairro" | "cidade" | "ativo">>;

export type Contexto = {
  cafes: CafeDoContexto[];
  rejeitadas: { cafe_id: string; campo: string | null; valor: unknown; rejeitada_em: string }[];
  cafes_novos_rejeitados: string[];
};

export type ResultadoDeBusca = { url: string; titulo: string; trecho: string };
export type PaginaExtraida = { url: string; texto: string };

export type Tavily = {
  buscar(consulta: string): Promise<ResultadoDeBusca[]>;
  /** Só as páginas que vieram; falha de uma URL não cobra nem lança. */
  extrair(urls: string[]): Promise<PaginaExtraida[]>;
};

export type EntradaDoGemini = {
  cafe: { nome: string; bairro: string; cidade: string };
  paginas: { url: string; titulo: string; texto: string }[];
};

export type Gemini = {
  /** A resposta JSON crua: quem valida é o `lerExtracao`. */
  extrair(entrada: EntradaDoGemini): Promise<unknown>;
};

export type RevisaoParaRegistrar = {
  tipo: "atualizacao" | "fechamento";
  cafe_id: string;
  campo: string | null;
  valor_atual: unknown;
  valor_proposto: unknown;
  fontes: { url: string; titulo: string; data_fonte: string | null; trecho: string; atualidade: string }[];
  atualidade: string;
  nome_normalizado: null;
};

export type Rodada = {
  inicio: string;
  cafes_verificados: number;
  chamadas_tavily: number;
  chamadas_gemini: number;
  erro: string | null;
};

export type Dependencias = {
  lerContexto(): Promise<Contexto>;
  registrar(rodada: Rodada, revisoes: RevisaoParaRegistrar[]): Promise<{ rodada_id: string; revisoes_criadas: number }>;
  tavily: Tavily;
  gemini: Gemini;
  agora: Date;
  limites?: { creditosTavily: number; chamadasGemini: number };
  /** Espera entre duas chamadas ao Gemini. */
  pausa: () => Promise<void>;
  log: (mensagem: string) => void;
};

/** Falha de um café, com o código curto que vai para a rodada. */
class FalhaDoCafe extends Error {
  constructor(readonly codigo: "busca" | "extracao" | "gemini" | "schema") {
    super(codigo);
  }
}

function montarErro(teto: boolean, falhas: Map<string, number>): string | null {
  const partes: string[] = [];
  if (teto) partes.push("teto");
  if (falhas.size > 0) partes.push(`falhas:${Array.from(falhas).map(([codigo, n]) => `${codigo}=${n}`).join(",")}`);
  return partes.length > 0 ? partes.join(";").slice(0, MAX_ERRO) : null;
}

function revisaoDaProposta(proposta: Proposta, agora: Date): RevisaoParaRegistrar {
  const { fontes, atualidade } = atualidadeDasFontes(proposta.fontes, proposta.campo, agora);
  return {
    tipo: proposta.tipo,
    cafe_id: proposta.cafeId,
    campo: proposta.campo,
    valor_atual: proposta.valorAtual,
    valor_proposto: proposta.valorProposto,
    fontes: fontes.map(({ url, titulo, data_fonte, trecho, atualidade: daFonte }) => ({
      url,
      titulo,
      data_fonte,
      trecho,
      atualidade: daFonte,
    })),
    atualidade,
    nome_normalizado: null,
  };
}

/**
 * Roda a rodada inteira. Falha de contexto ou de registro lança (o workflow
 * falha e o GitHub avisa por email); falha num café fica no `erro` da rodada e
 * a rodada segue.
 */
export async function rodarRodada(deps: Dependencias): Promise<{ rodada: Rodada; revisoes: RevisaoParaRegistrar[]; registro: { rodada_id: string; revisoes_criadas: number } }> {
  const { tavily, gemini, agora, pausa, log } = deps;
  const limites = deps.limites ?? LIMITES_PADRAO;
  const inicio = new Date(agora).toISOString();

  const contexto = await deps.lerContexto();
  const rejeitadas: Rejeitada[] = contexto.rejeitadas.map((r) => ({
    cafeId: r.cafe_id,
    campo: r.campo,
    valor: r.valor,
    rejeitadaEm: r.rejeitada_em,
  }));
  const daSemana = rodizio(
    contexto.cafes.filter((cafe) => cafe.ativo),
    agora,
  );
  log(`rodízio: ${daSemana.length} cafés nesta semana`);

  const revisoes: RevisaoParaRegistrar[] = [];
  const falhas = new Map<string, number>();
  let creditos = 0;
  let chamadasGemini = 0;
  let verificados = 0;
  let teto = false;

  for (const cafe of daSemana) {
    if (creditos + CREDITOS_POR_CAFE > limites.creditosTavily || chamadasGemini + 1 > limites.chamadasGemini) {
      teto = true;
      log("teto de chamadas atingido; encerrando a rodada");
      break;
    }
    verificados += 1;
    try {
      const propostas = await verificar(cafe);
      for (const proposta of propostas) revisoes.push(revisaoDaProposta(proposta, agora));
    } catch (erro) {
      // Só o código: a mensagem pode trazer URL, chave ou trecho de página.
      const codigo = erro instanceof FalhaDoCafe ? erro.codigo : "inesperada";
      falhas.set(codigo, (falhas.get(codigo) ?? 0) + 1);
      log(`café ${cafe.id}: falha (${codigo})`);
    }
  }

  async function verificar(cafe: CafeDoContexto): Promise<Proposta[]> {
    let resultados: ResultadoDeBusca[];
    try {
      creditos += 1;
      resultados = await tavily.buscar(`${cafe.nome} ${cafe.bairro} ${cafe.cidade}`);
    } catch {
      throw new FalhaDoCafe("busca");
    }

    const paginas = new Map<string, { titulo: string; texto: string }>();
    for (const r of resultados) paginas.set(r.url, { titulo: r.titulo, texto: r.trecho });

    const urls = resultados.map((r) => r.url).filter(podeExtrair).slice(0, PAGINAS_POR_CAFE);
    if (urls.length > 0) {
      try {
        const extraidas = await tavily.extrair(urls);
        creditos += Math.ceil(extraidas.length / PAGINAS_POR_CREDITO);
        for (const p of extraidas) {
          const antes = paginas.get(p.url);
          // A página inteira e o trecho da busca: o trecho citado pode vir de qualquer um.
          paginas.set(p.url, { titulo: antes?.titulo ?? p.url, texto: `${p.texto}\n${antes?.texto ?? ""}` });
        }
      } catch {
        throw new FalhaDoCafe("extracao");
      }
    }
    if (!Array.from(paginas.values()).some((p) => p.texto.trim() !== "")) return [];

    if (chamadasGemini > 0) await pausa();
    let bruto: unknown;
    try {
      chamadasGemini += 1;
      bruto = await gemini.extrair({
        cafe: { nome: cafe.nome, bairro: cafe.bairro, cidade: cafe.cidade },
        paginas: Array.from(paginas).map(([url, p]) => ({ url, ...p })),
      });
    } catch {
      throw new FalhaDoCafe("gemini");
    }

    let extracao: Extracao;
    try {
      extracao = lerExtracao(bruto);
    } catch {
      throw new FalhaDoCafe("schema");
    }

    // O modelo extrai e o código decide: trecho que não está na página derruba a fonte.
    const fatos = aFatos(extracao, (fonte) => {
      const pagina = paginas.get(fonte.url);
      return pagina !== undefined && trechoExisteNaPagina(fonte.trecho, pagina.texto);
    });
    return proporRevisoes(fatos, cafe as Cafe, rejeitadas, agora);
  }

  const rodada: Rodada = {
    inicio,
    cafes_verificados: verificados,
    chamadas_tavily: creditos,
    chamadas_gemini: chamadasGemini,
    erro: montarErro(teto, falhas),
  };
  const registro = await deps.registrar(rodada, revisoes);
  log(`rodada registrada: ${verificados} cafés, ${registro.revisoes_criadas} revisões, ${creditos} créditos Tavily, ${chamadasGemini} chamadas Gemini`);
  return { rodada, revisoes, registro };
}
