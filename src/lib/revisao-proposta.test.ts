import { describe, expect, it } from "vitest";
import { cafe } from "./cafe.fixture";
import {
  FECHADO_PERMANENTEMENTE,
  FECHADO_TEMPORARIAMENTE,
  nomeNormalizado,
  proporCafeNovo,
  proporRevisoes,
  type CandidatoCafeNovo,
  type Fato,
  type FatoBooleano,
  type FatosDoCafe,
  type Rejeitada,
} from "./revisao-proposta";

const AGORA = new Date("2026-10-28T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

const fonte = (n = 1) => ({
  url: `https://exemplo.com/${n}`,
  titulo: `Fonte ${n}`,
  data_fonte: "12/10/2026",
  trecho: `trecho ${n}`,
});
const fato = <T>(valor: T, n = 1): Fato<T> => ({ ...fonte(n), valor });
const booleano = (valor: boolean, negacaoExplicita?: boolean, n = 1): FatoBooleano => ({
  ...fato(valor, n),
  negacaoExplicita,
});

const propor = (fatos: FatosDoCafe, atributos = {}, rejeitadas: Rejeitada[] = []) =>
  proporRevisoes(fatos, cafe("a", atributos), rejeitadas, AGORA);

describe("proporRevisoes", () => {
  it("igual ao banco → nada", () => {
    const atual = cafe("a", { instagram: "https://instagram.com/casa", telefone: "(81) 3071-6834", faixa_preco: "$$" });
    const propostas = proporRevisoes(
      {
        instagram: [fato("@casa")],
        telefone: [fato("81 3071 6834")],
        faixa_preco: [fato("$$")],
        endereco: [fato(atual.endereco)],
        horario: [fato(atual.horario_funcionamento)],
        booleanos: { aceita_pets: [booleano(false, true)] },
      },
      atual,
      [],
      AGORA,
    );
    expect(propostas).toEqual([]);
  });

  it("Instagram e telefone saem no formato do banco", () => {
    const propostas = propor({ instagram: [fato("@casa.cafe")], telefone: [fato("81999084986")] });
    expect(propostas.map((p) => [p.campo, p.valorProposto])).toEqual([
      ["instagram", "https://instagram.com/casa.cafe"],
      ["telefone", "(81) 99908-4986"],
    ]);
    expect(propostas[0]).toMatchObject({ tipo: "atualizacao", cafeId: "a", valorAtual: null });
  });

  it("inválido pelo cafe-dados → descartado", () => {
    const propostas = propor({
      instagram: [fato("https://instagram.com/p/ABC123/")],
      telefone: [fato("123")],
      faixa_preco: [fato("$$$$")],
      horario: [fato({ segunda: "25:00 – 18:00", terca: "oito às seis" })],
    });
    expect(propostas).toEqual([]);
  });

  it("horário: só os dias válidos entram, sobre o horário atual", () => {
    const [proposta] = propor({ horario: [fato({ segunda: "08:00 – 18:00", terca: "lixo", sabado: "09:00 – 13:00, 15:00 – 20:00" })] });
    expect(proposta.campo).toBe("horario_funcionamento");
    expect(proposta.valorProposto).toMatchObject({
      segunda: "08:00 – 18:00",
      terca: "Fechado",
      sabado: "09:00 – 13:00, 15:00 – 20:00",
    });
  });

  it("endereço sem coordenadas", () => {
    const [proposta] = propor({ endereco: [fato("  Rua Nova, 10 ")] });
    expect(proposta).toMatchObject({ campo: "endereco", valorProposto: "Rua Nova, 10" });
    expect(JSON.stringify(proposta)).not.toMatch(/"lat"|"lng"/);
  });

  describe("booleanos", () => {
    it("true → false só com negação explícita", () => {
      expect(propor({ booleanos: { aceita_pets: [booleano(false)] } }, { aceita_pets: true })).toEqual([]);
      const [proposta] = propor({ booleanos: { aceita_pets: [booleano(false, true)] } }, { aceita_pets: true });
      expect(proposta).toMatchObject({ campo: "aceita_pets", valorAtual: true, valorProposto: false });
    });

    it("false → true não pede negação", () => {
      const [proposta] = propor({ booleanos: { acessivel_pcd: [booleano(true)] } });
      expect(proposta).toMatchObject({ campo: "acessivel_pcd", valorProposto: true });
    });

    it("null → valor no ar-condicionado", () => {
      const [proposta] = propor({ booleanos: { tem_ar_condicionado: [booleano(true)] } });
      expect(proposta).toMatchObject({ campo: "tem_ar_condicionado", valorAtual: null, valorProposto: true });
    });
  });

  describe("situação", () => {
    it("permanente → fechamento sem campo", () => {
      const [proposta] = propor({ situacao: [fato("permanente" as const)] });
      expect(proposta).toMatchObject({ tipo: "fechamento", campo: null, valorProposto: FECHADO_PERMANENTEMENTE });
    });

    it("temporária → indício, atualização sem campo", () => {
      const [proposta] = propor({ situacao: [fato("temporaria" as const)] });
      expect(proposta).toMatchObject({ tipo: "atualizacao", campo: null, valorProposto: FECHADO_TEMPORARIAMENTE });
    });

    it("café que já está fora do ar não gera fechamento", () => {
      expect(propor({ situacao: [fato("permanente" as const)] }, { ativo: false })).toEqual([]);
    });
  });

  describe("rejeitadas", () => {
    const rejeitadaHa = (dias: number, extra: Partial<Rejeitada> = {}): Rejeitada => ({
      cafeId: "a",
      campo: "instagram",
      valor: "https://instagram.com/casa",
      rejeitadaEm: new Date(AGORA.getTime() - dias * DIA).toISOString(),
      ...extra,
    });
    const fatos = { instagram: [fato("@casa")] };

    it("rejeitado há 89 dias → nada", () => {
      expect(propor(fatos, {}, [rejeitadaHa(89)])).toEqual([]);
    });

    it("rejeitado há 91 dias → volta", () => {
      expect(propor(fatos, {}, [rejeitadaHa(91)])).toHaveLength(1);
    });

    it("outro valor, outro campo ou outro café não bloqueiam", () => {
      expect(propor(fatos, {}, [rejeitadaHa(1, { valor: "https://instagram.com/outra" })])).toHaveLength(1);
      expect(propor(fatos, {}, [rejeitadaHa(1, { campo: "telefone" })])).toHaveLength(1);
      expect(propor(fatos, {}, [rejeitadaHa(1, { cafeId: "b" })])).toHaveLength(1);
    });

    it("horário rejeitado casa mesmo com as chaves em outra ordem", () => {
      const horario = { ...cafe("a").horario_funcionamento, segunda: "08:00 – 18:00" };
      const embaralhado = Object.fromEntries(Object.entries(horario).reverse());
      const rejeitada = rejeitadaHa(5, { campo: "horario_funcionamento", valor: embaralhado });
      expect(propor({ horario: [fato({ segunda: "08:00 – 18:00" })] }, {}, [rejeitada])).toEqual([]);
    });

    it("fechamento rejeitado há pouco não volta", () => {
      const rejeitada = rejeitadaHa(10, { campo: null, valor: FECHADO_PERMANENTEMENTE });
      expect(propor({ situacao: [fato("permanente" as const)] }, {}, [rejeitada])).toEqual([]);
    });

    it("com dois valores, o rejeitado cai e o outro fica", () => {
      const propostas = propor({ instagram: [fato("@casa", 1), fato("@casa2", 2)] }, {}, [rejeitadaHa(5)]);
      expect(propostas[0].valorProposto).toBe("https://instagram.com/casa2");
    });
  });

  it("fontes discordando aparecem todas, cada uma com o seu valor", () => {
    const [proposta] = propor({ instagram: [fato("@casa", 1), fato("@casa", 2), fato("@outra", 3)] });
    expect(proposta.valorProposto).toBe("https://instagram.com/casa");
    expect(proposta.fontes.map((f) => [f.url, f.valor])).toEqual([
      ["https://exemplo.com/1", "https://instagram.com/casa"],
      ["https://exemplo.com/2", "https://instagram.com/casa"],
      ["https://exemplo.com/3", "https://instagram.com/outra"],
    ]);
    expect(proposta.fontes[2]).toMatchObject({ titulo: "Fonte 3", data_fonte: "12/10/2026", trecho: "trecho 3" });
  });

  it("fonte que concorda com o banco entra como evidência quando outra discorda", () => {
    const [proposta] = propor({ faixa_preco: [fato("$$", 1), fato("$$$", 2)] });
    expect(proposta.valorProposto).toBe("$$$");
    expect(proposta.fontes).toHaveLength(2);
  });
});

describe("nomeNormalizado", () => {
  it("ignora caixa, acento e sufixos de café nas pontas", () => {
    expect(nomeNormalizado("Santa Clara Café")).toBe("santa-clara");
    expect(nomeNormalizado("Cafeteria Santa Clara")).toBe("santa-clara");
    expect(nomeNormalizado("SÃO BRAZ coffee shop")).toBe("sao-braz");
    expect(nomeNormalizado("Café Coffee Mira")).toBe("mira");
  });

  it("palavra do meio fica", () => {
    expect(nomeNormalizado("Casa do Café Expresso")).toBe("casa-do-cafe-expresso");
  });

  it("nome só de sufixo não vira vazio", () => {
    expect(nomeNormalizado("Café")).toBe("cafe");
  });
});

describe("proporCafeNovo", () => {
  const sinal = { sinal: "torra própria", trecho: "Torramos nossos grãos aqui mesmo", url: "https://exemplo.com/1" };
  const candidato = (extra: Partial<CandidatoCafeNovo> = {}): CandidatoCafeNovo => ({
    nome: "Grão Novo Café",
    cidade: "Recife",
    sinais: [sinal],
    fontes: [fonte(1)],
    ...extra,
  });
  const propor = (extra: Partial<CandidatoCafeNovo> = {}, cafes = [cafe("x", { nome: "Outro" })], rejeitados: string[] = []) =>
    proporCafeNovo(candidato(extra), cafes, rejeitados);

  it("com sinal, nas três cidades → proposta", () => {
    expect(propor()).toMatchObject({
      tipo: "cafe_novo",
      nomeNormalizado: "grao-novo",
      valorProposto: { nome: "Grão Novo Café", cidade: "Recife", sinais: [sinal] },
      fontes: [fonte(1)],
    });
  });

  it("fora das três cidades → nada", () => {
    expect(propor({ cidade: "Paulista" })).toBeNull();
    expect(propor({ cidade: "" })).toBeNull();
  });

  it("cidade sem caixa nem acento, e Jaboatão sozinho, viram o valor do banco", () => {
    expect(propor({ cidade: "OLINDA" })?.valorProposto.cidade).toBe("Olinda");
    expect(propor({ cidade: "jaboatao dos guararapes" })?.valorProposto.cidade).toBe("Jaboatão dos Guararapes");
    expect(propor({ cidade: "Jaboatão" })?.valorProposto.cidade).toBe("Jaboatão dos Guararapes");
  });

  it("sem nome → nada", () => {
    expect(propor({ nome: "  " })).toBeNull();
  });

  it("sem sinal, ou sinal sem trecho, → nada", () => {
    expect(propor({ sinais: [] })).toBeNull();
    expect(propor({ sinais: [{ ...sinal, trecho: "  " }] })).toBeNull();
    expect(propor({ sinais: [{ ...sinal, url: "" }] })).toBeNull();
  });

  it("Santa Clara e São Braz sem sinal → proposta", () => {
    expect(propor({ nome: "Santa Clara", sinais: [] })).toMatchObject({ nomeNormalizado: "santa-clara" });
    expect(propor({ nome: "Café São Braz Boa Viagem", sinais: [] })).toMatchObject({
      nomeNormalizado: "sao-braz-boa-viagem",
      valorProposto: { sinais: [] },
    });
  });

  it("nome que só começa parecido não é exceção", () => {
    expect(propor({ nome: "Santa Claraíso", sinais: [] })).toBeNull();
  });

  it("duplicado de café ativo ou inativo, pelo nome normalizado → nada", () => {
    expect(propor({ nome: "Cafeteria Grão Novo" }, [cafe("x", { nome: "Grão Novo" })])).toBeNull();
    expect(propor({}, [cafe("x", { nome: "GRAO NOVO coffee", ativo: false })])).toBeNull();
  });

  it("rejeitado nunca volta", () => {
    expect(propor({}, [], ["grao-novo"])).toBeNull();
    expect(propor({ nome: "Santa Clara Café", sinais: [] }, [], ["santa-clara"])).toBeNull();
  });

  it("campos no formato do banco, sem slug nem coordenadas", () => {
    const proposta = propor({
      bairro: " Casa Forte ",
      endereco: " Rua Nova, 10 ",
      instagram: "@grao.novo",
      telefone: "81999084986",
      horario: { segunda: "08:00 – 18:00", terca: "lixo" },
      faixa_preco: "$$",
      booleanos: { aceita_pets: { valor: true }, acessivel_pcd: { valor: false, negacaoExplicita: true } },
    });
    expect(proposta?.valorProposto).toEqual({
      nome: "Grão Novo Café",
      cidade: "Recife",
      bairro: "Casa Forte",
      endereco: "Rua Nova, 10",
      instagram: "https://instagram.com/grao.novo",
      telefone: "(81) 99908-4986",
      horario_funcionamento: { segunda: "08:00 – 18:00" },
      faixa_preco: "$$",
      aceita_pets: true,
      acessivel_pcd: false,
      sinais: [sinal],
    });
  });

  it("opcional inválido fica de fora; false sem negação explícita também", () => {
    const proposta = propor({
      bairro: "x".repeat(61),
      instagram: "https://instagram.com/p/ABC/",
      telefone: "123",
      horario: { segunda: "25:00 – 18:00" },
      faixa_preco: "$$$$",
      booleanos: { tem_estacionamento: { valor: false } },
    });
    expect(proposta?.valorProposto).toEqual({ nome: "Grão Novo Café", cidade: "Recife", sinais: [sinal] });
  });
});
