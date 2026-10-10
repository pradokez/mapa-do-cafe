import { describe, expect, it } from "vitest";

import { brCodePix, configDoPix, crc16Pix, rotuloDoValor, VALOR_PADRAO, VALORES_DE_APOIO } from "./pix";

// Copia e cola do QR estático sem valor gerado pelo app do Inter para a chave
// aleatória do site (#120). A chave é pública por natureza: vai em todo QR.
const COPIA_E_COLA_DO_INTER =
  "00020101021126580014br.gov.bcb.pix01364f6b5d56-9bc5-4152-a784-63cfe953eaf35204000053039865802BR5921KEZIAH OLIVEIRA PRADO6009FORTALEZA62070503***63045A67";

const CONFIG = { chave: "4f6b5d56-9bc5-4152-a784-63cfe953eaf3", nome: "Keziah Oliveira Prado", cidade: "Fortaleza" };

/** Lê um nível de TLV, conferindo que cada tamanho bate com o conteúdo. */
function lerTlv(texto: string): [string, string][] {
  const campos: [string, string][] = [];
  let i = 0;
  while (i < texto.length) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    const valor = texto.slice(i + 4, i + 4 + tamanho);
    expect(valor).toHaveLength(tamanho);
    campos.push([id, valor]);
    i += 4 + tamanho;
  }
  return campos;
}

const campo = (codigo: string, id: string) => lerTlv(codigo).find(([chave]) => chave === id)?.[1];

describe("brCodePix", () => {
  it("com os dados reais e valor livre, reproduz o copia e cola do Inter caractere por caractere", () => {
    expect(brCodePix({ ...CONFIG, valor: null })).toBe(COPIA_E_COLA_DO_INTER);
  });

  it.each([
    [5, "5.00"],
    [10, "10.00"],
    [20, "20.00"],
  ])("com R$ %d, o campo 54 leva %s (ponto e duas casas)", (valor, esperado) => {
    expect(campo(brCodePix({ ...CONFIG, valor }), "54")).toBe(esperado);
  });

  it("no valor livre, não há campo 54: o valor fica para o app do banco", () => {
    expect(campo(brCodePix({ ...CONFIG, valor: null }), "54")).toBeUndefined();
  });

  it("com valor, o resto do código segue o do Inter, com o 54 entre a moeda e o país", () => {
    const ids = lerTlv(brCodePix({ ...CONFIG, valor: 5 })).map(([id]) => id);
    expect(ids).toEqual(["00", "01", "26", "52", "53", "54", "58", "59", "60", "62", "63"]);
  });

  it("nome e cidade saem sem acento e em maiúsculas", () => {
    const codigo = brCodePix({ ...CONFIG, nome: "Conceição Araújo", cidade: "Jaboatão", valor: null });
    expect(campo(codigo, "59")).toBe("CONCEICAO ARAUJO");
    expect(campo(codigo, "60")).toBe("JABOATAO");
  });

  it("nome é truncado em 25 caracteres e cidade em 15, sem espaço sobrando no fim", () => {
    const codigo = brCodePix({
      ...CONFIG,
      nome: "Maria  da Conceição Albuquerque Cavalcanti",
      cidade: "Jaboatão dos Guararapes",
      valor: null,
    });
    expect(campo(codigo, "59")).toBe("MARIA DA CONCEICAO ALBUQU");
    expect(campo(codigo, "60")).toBe("JABOATAO DOS GU");

    // O corte cai num espaço: ele não fica no fim do campo.
    expect(campo(brCodePix({ ...CONFIG, cidade: "Belo Horizonte Sul", valor: null }), "60")).toBe("BELO HORIZONTE");
    expect(campo(brCodePix({ ...CONFIG, nome: "Ana Beatriz Sousa Vieira Lima", valor: null }), "59")).toBe(
      "ANA BEATRIZ SOUSA VIEIRA",
    );
  });

  it.each([
    ["chave aleatória", "4f6b5d56-9bc5-4152-a784-63cfe953eaf3", "Ana", "Recife"],
    ["email", "cafe@exemplo.com", "Keziah Oliveira Prado", "Fortaleza"],
    ["telefone", "+5581999999999", "Bia", "Olinda"],
    ["chave no limite de 77", "x".repeat(77), "Nome Bem Comprido Que Passa", "Cidade Comprida Demais"],
  ])("tamanhos do TLV corretos com %s", (_, chave, nome, cidade) => {
    for (const valor of [null, 5, 20]) {
      const codigo = brCodePix({ chave, nome, cidade, valor });
      const conta = campo(codigo, "26")!;
      expect(lerTlv(conta)).toEqual([
        ["00", "br.gov.bcb.pix"],
        ["01", chave],
      ]);
      expect(lerTlv(campo(codigo, "62")!)).toEqual([["05", "***"]]);
      expect(codigo.slice(-4)).toBe(crc16Pix(codigo.slice(0, -4)));
    }
  });
});

describe("crc16Pix", () => {
  it("confere com o exemplo do manual do BR Code", () => {
    expect(
      crc16Pix(
        "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304",
      ),
    ).toBe("1D3D");
  });

  it("confere com o valor de checagem do CRC-16/CCITT-FALSE e sai com 4 hex maiúsculos", () => {
    expect(crc16Pix("123456789")).toBe("29B1");
    expect(crc16Pix("")).toBe("FFFF");
  });
});

describe("VALORES_DE_APOIO", () => {
  it("são R$ 5, R$ 10, R$ 20 e Livre, nessa ordem, com R$ 5 de padrão", () => {
    expect(VALORES_DE_APOIO).toEqual([5, 10, 20, null]);
    expect(VALORES_DE_APOIO.map(rotuloDoValor)).toEqual(["R$ 5", "R$ 10", "R$ 20", "Livre"]);
    expect(VALOR_PADRAO).toBe(5);
  });
});

describe("configDoPix", () => {
  const CHAVE = "4f6b5d56-9bc5-4152-a784-63cfe953eaf3";

  it("lê chave, nome e cidade das envs", () => {
    expect(configDoPix({ PIX_CHAVE: CHAVE, PIX_NOME: "Ana", PIX_CIDADE: "Recife" })).toEqual({
      chave: CHAVE,
      nome: "Ana",
      cidade: "Recife",
    });
  });

  it("sem nome e cidade, usa os do copia e cola do Inter — o código bate com ele", () => {
    const config = configDoPix({ PIX_CHAVE: CHAVE, PIX_NOME: " ", PIX_CIDADE: "" });
    expect(config).toEqual({ chave: CHAVE, nome: "KEZIAH OLIVEIRA PRADO", cidade: "FORTALEZA" });
    expect(brCodePix({ ...config!, valor: null })).toBe(COPIA_E_COLA_DO_INTER);
    expect(configDoPix({ PIX_CHAVE: CHAVE })).toEqual(config);
  });

  it("apara espaços da chave", () => {
    expect(configDoPix({ PIX_CHAVE: ` ${CHAVE}\n` })?.chave).toBe(CHAVE);
  });

  it.each([
    ["sem env nenhuma", {}],
    ["chave vazia", { PIX_CHAVE: "" }],
    ["chave só de espaços", { PIX_CHAVE: "   " }],
    ["chave acima de 77 caracteres (não cabe no campo 26)", { PIX_CHAVE: "x".repeat(78) }],
  ])("%s → null (o botão não aparece)", (_, env) => {
    expect(configDoPix(env)).toBeNull();
  });

  it("chave de 77 caracteres ainda cabe", () => {
    expect(configDoPix({ PIX_CHAVE: "x".repeat(77) })?.chave).toHaveLength(77);
  });
});
