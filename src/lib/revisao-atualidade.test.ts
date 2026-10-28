import { describe, expect, it } from "vitest";

import { atualidadeDasFontes } from "./revisao-atualidade";
import type { FonteDaProposta } from "./revisao-proposta";

// Quarta, 28/10/2026, meio-dia em Recife. A janela de 6 meses vai até 28/04/2026.
const AGORA = new Date("2026-10-28T12:00:00-03:00");

function fonte(data_fonte: string | null, opcoes: { trecho?: string; valor?: unknown } = {}): FonteDaProposta {
  return {
    url: "https://exemplo.com.br/post",
    titulo: "Post do café",
    data_fonte,
    trecho: opcoes.trecho ?? `Publicado em ${data_fonte ?? "algum dia"}: abrimos das 8h às 18h.`,
    valor: opcoes.valor ?? "(81) 3071-6834",
  };
}

const atualidade = (fontes: FonteDaProposta[], agora = AGORA) => atualidadeDasFontes(fontes, "telefone", agora).atualidade;
const daFonte = (f: FonteDaProposta, agora = AGORA) => atualidadeDasFontes([f], "telefone", agora).fontes[0].atualidade;

describe("atualidadeDasFontes — janela de 6 meses", () => {
  it("data dentro dos 6 meses é atualizada", () => {
    expect(daFonte(fonte("15/09/2026"))).toBe("atualizada");
    expect(daFonte(fonte("28/10/2026"))).toBe("atualizada");
  });

  it("data fora dos 6 meses é antiga", () => {
    expect(daFonte(fonte("12/03/2026"))).toBe("antiga");
    expect(daFonte(fonte("05/02/2023"))).toBe("antiga");
  });

  it("a borda é o mesmo dia, 6 meses antes: entra; um dia antes, não", () => {
    expect(daFonte(fonte("28/04/2026"))).toBe("atualizada");
    expect(daFonte(fonte("27/04/2026"))).toBe("antiga");
  });

  it("a borda segue o dia de Recife, não o do servidor em UTC", () => {
    // 22h de 28/10 em Recife já é 29/10 em UTC.
    const noiteEmRecife = new Date("2026-10-29T01:00:00Z");
    expect(daFonte(fonte("28/04/2026"), noiteEmRecife)).toBe("atualizada");
    expect(daFonte(fonte("29/10/2026"), noiteEmRecife)).toBe("sem_data");

    // 00h30 de 29/10 em Recife: a janela andou um dia.
    const madrugadaEmRecife = new Date("2026-10-29T03:30:00Z");
    expect(daFonte(fonte("28/04/2026"), madrugadaEmRecife)).toBe("antiga");
    expect(daFonte(fonte("29/10/2026"), madrugadaEmRecife)).toBe("atualizada");
  });

  it("no fim do mês, a borda cai no último dia do mês de 6 meses antes", () => {
    const fimDeAgosto = new Date("2026-08-31T12:00:00-03:00");
    expect(daFonte(fonte("28/02/2026"), fimDeAgosto)).toBe("atualizada");
    expect(daFonte(fonte("27/02/2026"), fimDeAgosto)).toBe("antiga");
  });

  it("data só com o mês vale pelo primeiro dia dele", () => {
    expect(daFonte(fonte("mai 2026"))).toBe("atualizada");
    expect(daFonte(fonte("abr 2026"))).toBe("antiga");
  });
});

describe("atualidadeDasFontes — formatos de data", () => {
  it.each([
    ["dd/mm/aaaa", "12/09/2026"],
    ["d/m/aaaa", "3/9/2026"],
    ["por extenso", "12 de setembro de 2026"],
    ["por extenso com acento", "3 de março de 2026"],
    ["mês abreviado com dia", "12 set. 2026"],
    ["mês e ano abreviados", "set 2026"],
    ["mês por extenso e ano", "setembro de 2026"],
    ["mês/ano", "09/2026"],
    ["ISO", "2026-09-12"],
    ["ISO com hora", "2026-09-12T14:30:00Z"],
    ["ISO só com o mês", "2026-09"],
  ])("lê %s (%s)", (_, data) => {
    expect(daFonte(fonte(data))).not.toBe("sem_data");
  });

  it("lê caixa alta e sem acento", () => {
    expect(daFonte(fonte("3 DE MARCO DE 2026"))).toBe("antiga");
  });

  it("aceita a data escrita de outro jeito no trecho", () => {
    expect(daFonte(fonte("12/09/2026", { trecho: "Atualizado em 12 de setembro de 2026." }))).toBe("atualizada");
    expect(daFonte(fonte("set 2026", { trecho: "Postado em 12/09/2026" }))).toBe("atualizada");
  });

  it("dia que não existe não é data", () => {
    expect(daFonte(fonte("31/02/2026"))).toBe("sem_data");
    expect(daFonte(fonte("12/13/2026"))).toBe("sem_data");
  });
});

describe("atualidadeDasFontes — sem data", () => {
  it.each(["há 3 semanas", "3 sem", "ontem", "há 2 dias", "2 d", "semana passada"])(
    "data relativa (%s) é sem data",
    (relativa) => {
      expect(daFonte(fonte(relativa))).toBe("sem_data");
    },
  );

  it("data ausente é sem data", () => {
    expect(daFonte(fonte(null))).toBe("sem_data");
    expect(daFonte(fonte(""))).toBe("sem_data");
  });

  it("só o ano não basta", () => {
    expect(daFonte(fonte("2026"))).toBe("sem_data");
  });

  it("data no futuro é sem data", () => {
    expect(daFonte(fonte("29/10/2026"))).toBe("sem_data");
    expect(daFonte(fonte("nov 2026"))).toBe("sem_data");
    expect(daFonte(fonte("out 2026"))).toBe("atualizada");
  });

  it("data que não aparece no trecho citado é sem data", () => {
    expect(daFonte(fonte("12/09/2026", { trecho: "Abrimos das 8h às 18h." }))).toBe("sem_data");
    expect(daFonte(fonte("12/09/2026", { trecho: "Atualizado em 13/09/2026." }))).toBe("sem_data");
    expect(daFonte(fonte("12/09/2026", { trecho: "Atualizado em 12/09/2025." }))).toBe("sem_data");
    // O dia não pode ser inventado: o trecho só diz o mês.
    expect(daFonte(fonte("12/09/2026", { trecho: "Cardápio de set 2026" }))).toBe("sem_data");
  });

  it("número que só parece data não conta", () => {
    expect(daFonte(fonte("12/09/2026", { trecho: "Ligue (81) 3071-6834 ou 12/09/20266" }))).toBe("sem_data");
    expect(daFonte(fonte("mar 2026", { trecho: "Lugar de amar 2026 vezes" }))).toBe("sem_data");
  });
});

describe("atualidadeDasFontes — a revisão", () => {
  it("sem nenhuma fonte, é sem data", () => {
    expect(atualidadeDasFontes([], "telefone", AGORA)).toEqual({ fontes: [], atualidade: "sem_data" });
  });

  it("devolve as fontes na mesma ordem, cada uma com a sua atualidade", () => {
    const fontes = [fonte("12/03/2026"), fonte(null), fonte("15/09/2026")];
    const resultado = atualidadeDasFontes(fontes, "telefone", AGORA);
    expect(resultado.fontes).toEqual([
      { ...fontes[0], atualidade: "antiga" },
      { ...fontes[1], atualidade: "sem_data" },
      { ...fontes[2], atualidade: "atualizada" },
    ]);
  });

  it("herda a atualidade da fonte datada mais recente", () => {
    expect(atualidade([fonte("12/03/2026"), fonte("15/09/2026")])).toBe("atualizada");
    expect(atualidade([fonte("12/03/2026"), fonte("05/02/2023")])).toBe("antiga");
  });

  it("fonte sem data não vence a datada", () => {
    expect(atualidade([fonte(null), fonte("12/03/2026")])).toBe("antiga");
  });

  it("todas sem data e concordando, é sem data", () => {
    expect(atualidade([fonte(null), fonte("há 3 semanas")])).toBe("sem_data");
  });

  it("fontes datadas que discordam com menos de 30 dias entre si são conflito", () => {
    expect(atualidade([fonte("01/10/2026", { valor: "A" }), fonte("20/10/2026", { valor: "B" })])).toBe("conflito");
    expect(atualidade([fonte("01/10/2026", { valor: "A" }), fonte("30/10/2025", { valor: "B" }), fonte("25/10/2026", { valor: "B" })])).toBe("conflito");
  });

  it("com 30 dias ou mais entre elas, a mais recente vence", () => {
    expect(atualidade([fonte("01/09/2026", { valor: "A" }), fonte("01/10/2026", { valor: "B" })])).toBe("atualizada");
    expect(atualidade([fonte("12/03/2025", { valor: "A" }), fonte("15/09/2026", { valor: "B" })])).toBe("atualizada");
  });

  it("fontes próximas que concordam não são conflito", () => {
    expect(atualidade([fonte("01/10/2026"), fonte("02/10/2026")])).toBe("atualizada");
  });

  it("horário igual com as chaves em outra ordem não é discordância", () => {
    const a = { segunda: "08:00 – 18:00", terca: "08:00 – 18:00" };
    const b = { terca: "08:00 – 18:00", segunda: "08:00 – 18:00" };
    expect(atualidade([fonte("01/10/2026", { valor: a }), fonte("02/10/2026", { valor: b })])).toBe("atualizada");
  });

  it("só fontes sem data discordando é conflito", () => {
    expect(atualidade([fonte(null, { valor: "A" }), fonte("há 3 semanas", { valor: "B" })])).toBe("conflito");
  });

  it("fonte sem data discordando de uma datada não é conflito", () => {
    expect(atualidade([fonte(null, { valor: "A" }), fonte("15/09/2026", { valor: "B" })])).toBe("atualizada");
  });
});
