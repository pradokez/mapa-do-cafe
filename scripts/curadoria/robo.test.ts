import { describe, expect, it, vi } from "vitest";

import { rodizio } from "../../src/lib/rodizio";
import { rodarRodada, type CafeDoContexto, type Dependencias, type Gemini, type Tavily } from "./robo";

const AGORA = new Date("2026-10-28T15:00:00Z");
const CHAVE = "chave-secreta-tavily-123";
const SEGREDO = "segredo-do-robo-456";
const CORPO = "CORPO-DA-PAGINA-QUE-NAO-PODE-IR-AO-LOG";

function cafe(n: number, extra: Partial<CafeDoContexto> = {}): CafeDoContexto {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    nome: `Café ${n}`,
    bairro: "Graças",
    cidade: "Recife",
    ativo: true,
    endereco: "Rua A, 1",
    aceita_pets: false,
    tem_estacionamento: false,
    permite_coffee_office: false,
    acessivel_pcd: false,
    opcoes_vegetarianas: false,
    tem_ar_condicionado: null,
    faixa_preco: "$$",
    horario_funcionamento: {
      segunda: "08:00 – 18:00", terca: "08:00 – 18:00", quarta: "08:00 – 18:00", quinta: "08:00 – 18:00",
      sexta: "08:00 – 18:00", sabado: "08:00 – 18:00", domingo: "Fechado",
    },
    instagram: null,
    telefone: null,
    ...extra,
  } as CafeDoContexto;
}

const TODOS = Array.from({ length: 12 }, (_, i) => cafe(i + 1));
const DA_SEMANA = rodizio(TODOS, AGORA);

const URL_SITE = "https://guia.example.com/cafe";
const TEXTO = `Aberto desde 2020. Siga no Instagram @cafe_x (atualizado em 20/10/2026). ${CORPO}`;
const TRECHO_INSTA = "Siga no Instagram @cafe_x (atualizado em 20/10/2026)";

function citacao(trecho: string, url = URL_SITE) {
  return { url, titulo: "Guia", data_fonte: "20/10/2026", trecho };
}
function vazia() {
  return { horario: [], instagram: [], telefone: [], endereco: [], faixa_preco: [], booleanos: [], situacao: [] };
}

function deps(over: Partial<Omit<Dependencias, "tavily" | "gemini">> & { tavily?: Partial<Tavily>; gemini?: Partial<Gemini> } = {}) {
  const log = vi.fn();
  const registrar = (over.registrar ?? vi.fn(async () => ({ rodada_id: "r1", revisoes_criadas: 0 }))) as ReturnType<typeof vi.fn>;
  const tavily = {
    buscar: vi.fn(over.tavily?.buscar ?? (async () => [{ url: URL_SITE, titulo: "Guia", trecho: "resumo" }])),
    extrair: vi.fn(over.tavily?.extrair ?? (async () => [{ url: URL_SITE, texto: TEXTO }])),
  };
  const gemini = { extrair: vi.fn(over.gemini?.extrair ?? (async () => vazia())) };
  const pausa = vi.fn(async () => {});
  const base: Dependencias = {
    lerContexto: async () => ({ cafes: TODOS, rejeitadas: [], cafes_novos_rejeitados: [] }),
    agora: AGORA,
    pausa,
    ...over,
    log,
    registrar,
    tavily,
    gemini,
  };
  return { ...base, registrar, log, tavily, gemini, pausa };
}

describe("rodarRodada", () => {
  it("verifica só os cafés do rodízio da semana", async () => {
    const d = deps();
    await rodarRodada(d);
    const buscas = (d.tavily.buscar as ReturnType<typeof vi.fn>).mock.calls.map(([q]) => q as string);
    expect(buscas).toHaveLength(DA_SEMANA.length);
    for (const c of DA_SEMANA) expect(buscas.some((q) => q.startsWith(c.nome))).toBe(true);
    expect(d.registrar.mock.calls[0][0].cafes_verificados).toBe(DA_SEMANA.length);
  });

  it("café fora do ar não entra no rodízio", async () => {
    const inativos = TODOS.map((c) => ({ ...c, ativo: false }));
    const d = deps({ lerContexto: async () => ({ cafes: inativos, rejeitadas: [], cafes_novos_rejeitados: [] }) });
    await rodarRodada(d);
    expect(d.tavily.buscar).not.toHaveBeenCalled();
  });

  it("propõe o que difere do banco, com a fonte e a atualidade", async () => {
    const d = deps({
      gemini: {
        extrair: async () => ({
          ...vazia(),
          instagram: [{ valor: "@cafe_x", ...citacao(TRECHO_INSTA) }],
        }),
      },
    });
    const { revisoes } = await rodarRodada(d);
    expect(revisoes.length).toBe(DA_SEMANA.length);
    expect(revisoes[0]).toMatchObject({
      tipo: "atualizacao",
      campo: "instagram",
      valor_proposto: "https://instagram.com/cafe_x",
      atualidade: "atualizada",
      nome_normalizado: null,
    });
    expect(revisoes[0].fontes[0]).toEqual({ url: URL_SITE, titulo: "Guia", data_fonte: "20/10/2026", trecho: TRECHO_INSTA, atualidade: "atualizada" });
    expect(d.registrar.mock.calls[0][1]).toEqual(revisoes);
  });

  it("descarta a fonte cujo trecho não está na página", async () => {
    const d = deps({
      gemini: {
        extrair: async () => ({
          ...vazia(),
          instagram: [{ valor: "@inventado", ...citacao("Nosso Instagram é @inventado") }],
        }),
      },
    });
    const { revisoes } = await rodarRodada(d);
    expect(revisoes).toEqual([]);
  });

  it("descarta a fonte de uma URL que não foi lida", async () => {
    const d = deps({
      gemini: {
        extrair: async () => ({
          ...vazia(),
          instagram: [{ valor: "@cafe_x", ...citacao(TRECHO_INSTA, "https://outra.example.com/") }],
        }),
      },
    });
    expect((await rodarRodada(d)).revisoes).toEqual([]);
  });

  it("respeita o teto de chamadas e termina limpa, registrando o que fez", async () => {
    const d = deps({ limites: { creditosTavily: 4, chamadasGemini: 18 } });
    const { rodada } = await rodarRodada(d);
    expect(d.tavily.buscar).toHaveBeenCalledTimes(2);
    expect(rodada.chamadas_tavily).toBeLessThanOrEqual(4);
    expect(rodada.cafes_verificados).toBe(2);
    expect(rodada.erro).toBe("teto");
    expect(d.registrar).toHaveBeenCalledTimes(1);
  });

  it("respeita o teto de chamadas do Gemini", async () => {
    const d = deps({ limites: { creditosTavily: 70, chamadasGemini: 1 } });
    const { rodada } = await rodarRodada(d);
    expect(d.gemini.extrair).toHaveBeenCalledTimes(1);
    expect(rodada.erro).toBe("teto");
  });

  it("pausa entre as chamadas ao Gemini, não antes da primeira", async () => {
    const d = deps();
    await rodarRodada(d);
    expect(d.pausa).toHaveBeenCalledTimes(DA_SEMANA.length - 1);
  });

  it("falha num café é registrada e a rodada segue", async () => {
    let n = 0;
    const d = deps({
      gemini: {
        extrair: async () => {
          if (++n === 1) throw new Error(`503 ${CHAVE}`);
          return vazia();
        },
      },
    });
    const { rodada } = await rodarRodada(d);
    expect(d.gemini.extrair).toHaveBeenCalledTimes(DA_SEMANA.length);
    expect(rodada.erro).toBe("falhas:gemini=1");
    expect(d.registrar).toHaveBeenCalledTimes(1);
  });

  it("resposta malformada do Gemini é falha só daquele café", async () => {
    let n = 0;
    const d = deps({
      gemini: {
        extrair: async () => {
          if (++n === 1) return { horario: "segunda às 8h" };
          return vazia();
        },
      },
    });
    const { rodada } = await rodarRodada(d);
    expect(rodada.erro).toBe("falhas:schema=1");
    expect(rodada.cafes_verificados).toBe(DA_SEMANA.length);
  });

  it("falha na busca ou no extract vira código, sem mensagem de terceiros", async () => {
    const d = deps({
      tavily: {
        buscar: vi.fn(async () => {
          throw new Error(`401 ${CHAVE}`);
        }),
      },
    });
    const { rodada } = await rodarRodada(d);
    expect(rodada.erro).toBe(`falhas:busca=${DA_SEMANA.length}`);
  });

  it("Instagram e Facebook nunca vão ao Extract; o trecho da busca basta como fonte", async () => {
    const insta = "https://www.instagram.com/p/abc/";
    const d = deps({
      tavily: {
        buscar: vi.fn(async () => [
          { url: insta, titulo: "Post", trecho: "Horário novo: seg a sex 9h às 17h. Postado em 20/10/2026" },
          { url: "https://m.facebook.com/x", titulo: "FB", trecho: "outra coisa" },
          { url: URL_SITE, titulo: "Guia", trecho: "resumo" },
        ]),
      },
      gemini: {
        extrair: async () => ({
          ...vazia(),
          telefone: [{ valor: "(81) 99999-1234", url: insta, titulo: "Post", data_fonte: "20/10/2026", trecho: "Horário novo: seg a sex 9h às 17h. Postado em 20/10/2026" }],
        }),
      },
    });
    const { revisoes } = await rodarRodada(d);
    for (const [urls] of (d.tavily.extrair as ReturnType<typeof vi.fn>).mock.calls) {
      expect(urls).toEqual([URL_SITE]);
    }
    expect(revisoes.length).toBeGreaterThan(0);
  });

  it("falha no registro faz a rodada lançar", async () => {
    const d = deps({ registrar: vi.fn(async () => { throw new Error("MC429"); }) });
    await expect(rodarRodada(d)).rejects.toThrow("MC429");
  });

  it("falha no contexto faz a rodada lançar, sem tocar em Tavily nem Gemini", async () => {
    const d = deps({ lerContexto: async () => { throw new Error("MC401"); } });
    await expect(rodarRodada(d)).rejects.toThrow("MC401");
    expect(d.tavily.buscar).not.toHaveBeenCalled();
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("o log não leva chave, segredo nem corpo de página", async () => {
    let n = 0;
    const d = deps({
      tavily: {
        extrair: vi.fn(async () => {
          if (++n === 1) throw new Error(`falhou com ${CHAVE} e ${SEGREDO}`);
          return [{ url: URL_SITE, texto: TEXTO }];
        }),
      },
      gemini: { extrair: async () => { throw new Error(`erro ${CHAVE} ${CORPO}`); } },
    });
    await rodarRodada(d);
    const log = d.log.mock.calls.map(([m]) => m).join("\n");
    expect(log).not.toContain(CHAVE);
    expect(log).not.toContain(SEGREDO);
    expect(log).not.toContain(CORPO);
    expect(log).not.toContain(URL_SITE);
  });
});
