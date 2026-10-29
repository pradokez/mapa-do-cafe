import { describe, expect, it } from "vitest";

import { aCandidatoCafeNovo, aFatos, ExtracaoInvalida, lerCandidatos, lerExtracao } from "./schema";

const fonte = { url: "https://a.example/", titulo: "A", data_fonte: null, trecho: "t" };
const vazia = { horario: [], instagram: [], telefone: [], endereco: [], faixa_preco: [], booleanos: [], situacao: [] };

describe("lerExtracao", () => {
  it("aceita a resposta no schema, com data_fonte nula", () => {
    const e = lerExtracao({
      ...vazia,
      instagram: [{ valor: "@x", ...fonte }],
      booleanos: [{ campo: "aceita_pets", valor: false, negacao_explicita: true, ...fonte }],
      horario: [{ valor: { segunda: "08:00 – 18:00" }, ...fonte }],
    });
    expect(e.instagram[0].data_fonte).toBeNull();
    expect(e.booleanos[0].negacao_explicita).toBe(true);
  });

  it.each([
    ["não é objeto", "texto"],
    ["lista ausente", { ...vazia, horario: undefined }],
    ["fonte sem url", { ...vazia, instagram: [{ valor: "@x", titulo: "A", data_fonte: null, trecho: "t" }] }],
    ["data que não é texto nem null", { ...vazia, instagram: [{ valor: "@x", ...fonte, data_fonte: 2026 }] }],
    ["campo booleano desconhecido", { ...vazia, booleanos: [{ campo: "tem_wifi", valor: true, negacao_explicita: false, ...fonte }] }],
    ["situação fora da lista", { ...vazia, situacao: [{ valor: "talvez", ...fonte }] }],
  ])("recusa: %s", (_, bruto) => {
    expect(() => lerExtracao(bruto)).toThrow(ExtracaoInvalida);
  });
});

describe("aFatos", () => {
  it("só mantém as citações aprovadas e agrupa os booleanos por campo", () => {
    const e = lerExtracao({
      ...vazia,
      instagram: [{ valor: "@x", ...fonte }, { valor: "@y", ...fonte, url: "https://b.example/" }],
      booleanos: [{ campo: "aceita_pets", valor: true, negacao_explicita: false, ...fonte }],
    });
    const fatos = aFatos(e, (f) => f.url === "https://a.example/");
    expect(fatos.instagram).toHaveLength(1);
    expect(fatos.booleanos?.aceita_pets?.[0]).toMatchObject({ valor: true, negacaoExplicita: false });
  });
});

const sinal = { sinal: "grãos de origem", url: "https://a.example/", trecho: "grãos de origem única" };
const candidato = {
  nome: "Café Novo",
  cidade: "Recife",
  bairro: null,
  endereco: null,
  instagram: "@novo",
  telefone: null,
  horario: { segunda: "08:00 – 18:00" },
  faixa_preco: null,
  sinais: [sinal],
  fontes: [fonte],
};

describe("lerCandidatos", () => {
  it("aceita candidatos no schema, com opcionais nulos", () => {
    const { candidatos } = lerCandidatos({ candidatos: [candidato] });
    expect(candidatos[0]).toMatchObject({ nome: "Café Novo", bairro: null, horario: { segunda: "08:00 – 18:00" } });
    expect(candidatos[0].sinais).toEqual([sinal]);
  });

  it("aceita lista vazia", () => {
    expect(lerCandidatos({ candidatos: [] }).candidatos).toEqual([]);
  });

  it.each([
    ["não é objeto", "texto"],
    ["lista ausente", {}],
    ["candidato sem nome", { candidatos: [{ ...candidato, nome: undefined }] }],
    ["opcional que não é texto nem null", { candidatos: [{ ...candidato, bairro: 3 }] }],
    ["sinal sem trecho", { candidatos: [{ ...candidato, sinais: [{ sinal: "x", url: "u" }] }] }],
    ["fonte sem url", { candidatos: [{ ...candidato, fontes: [{ titulo: "A", data_fonte: null, trecho: "t" }] }] }],
    ["horário que não é objeto", { candidatos: [{ ...candidato, horario: "8h" }] }],
  ])("recusa: %s", (_, bruto) => {
    expect(() => lerCandidatos(bruto)).toThrow(ExtracaoInvalida);
  });
});

describe("aCandidatoCafeNovo", () => {
  const { candidatos } = lerCandidatos({
    candidatos: [{ ...candidato, sinais: [sinal, { ...sinal, trecho: "inventado" }], fontes: [fonte, { ...fonte, url: "https://b.example/" }] }],
  });

  it("mantém só sinais e fontes que a página sustenta", () => {
    const c = aCandidatoCafeNovo(candidatos[0], (f) => f.url === "https://a.example/" && f.trecho !== "inventado");
    expect(c.sinais).toEqual([sinal]);
    expect(c.fontes.map((f) => f.url)).toEqual(["https://a.example/"]);
    expect(c).toMatchObject({ nome: "Café Novo", cidade: "Recife", instagram: "@novo" });
  });

  it("a fonte do cadastro passa pelo próprio filtro, além do trecho (#213)", () => {
    const c = aCandidatoCafeNovo(candidatos[0], () => true, (f) => f.url === "https://b.example/");
    expect(c.sinais).toHaveLength(2);
    expect(c.fontes.map((f) => f.url)).toEqual(["https://b.example/"]);
  });

  it("a fonte de um sinal não entra sozinha entre as fontes (#213)", () => {
    const c = aCandidatoCafeNovo({ ...candidatos[0], fontes: [] }, () => true);
    expect(c.fontes).toEqual([]);
  });
});
