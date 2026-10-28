import { describe, expect, it } from "vitest";

import { aFatos, ExtracaoInvalida, lerExtracao } from "./schema";

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
