import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ateODia,
  combosDoCafe,
  edicoesNoAr,
  estadoDaEdicao,
  formatarPreco,
  ordenarPorNumero,
  participantesNoAr,
  periodoDaEdicao,
  rotuloDeStatus,
  tituloDoCombo,
  urlDaEdicao,
  urlPublicaDaArte,
  type Edicao,
  type Participacao,
} from "./festival";

const EU_AMO_CAFE: Edicao = {
  id: "e1",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [],
};

const RECIFE_COFFEE: Edicao = {
  ...EU_AMO_CAFE,
  id: "e2",
  festival: { slug: "recife-coffee", nome: "Recife Coffee" },
  inicio: "2026-11-01",
  fim: "2026-11-30",
};

/** Meio-dia em Recife (UTC−3) do dia `AAAA-MM-DD`. */
const meioDia = (dia: string) => new Date(`${dia}T15:00:00Z`);

describe("estadoDaEdicao", () => {
  it.each([
    ["2026-10-17", "futura"],
    ["2026-10-18", "ativa"],
    ["2026-11-01", "ativa"],
    ["2026-11-15", "ativa"],
    ["2026-11-16", "encerrada"],
  ] as const)("em %s, a edição de 18 out a 15 nov está %s", (dia, estado) => {
    expect(estadoDaEdicao(EU_AMO_CAFE, meioDia(dia))).toBe(estado);
  });

  it("o dia é o de Recife: 15 nov às 22h em Recife (já 16 nov em UTC) ainda é o último dia", () => {
    expect(estadoDaEdicao(EU_AMO_CAFE, new Date("2026-11-16T01:00:00Z"))).toBe("ativa");
  });

  it("e 17 out às 22h em Recife (já 18 em UTC) ainda é véspera", () => {
    expect(estadoDaEdicao(EU_AMO_CAFE, new Date("2026-10-18T01:00:00Z"))).toBe("futura");
  });
});

describe("edicoesNoAr", () => {
  it("no ar do dia em que é publicada até o último dia, inclusive antes de começar", () => {
    expect(edicoesNoAr([EU_AMO_CAFE], meioDia("2026-10-10"))).toEqual([EU_AMO_CAFE]);
    expect(edicoesNoAr([EU_AMO_CAFE], meioDia("2026-10-18"))).toEqual([EU_AMO_CAFE]);
    expect(edicoesNoAr([EU_AMO_CAFE], meioDia("2026-11-15"))).toEqual([EU_AMO_CAFE]);
  });

  it("sai do ar sozinha no dia seguinte ao último", () => {
    expect(edicoesNoAr([EU_AMO_CAFE], meioDia("2026-11-16"))).toEqual([]);
  });

  it("edição não publicada nunca está no ar, nem antes nem durante o período", () => {
    const rascunho = { ...EU_AMO_CAFE, publicada: false };
    expect(edicoesNoAr([rascunho], meioDia("2026-10-10"))).toEqual([]);
    expect(edicoesNoAr([rascunho], meioDia("2026-11-01"))).toEqual([]);
  });

  it("vira o dia em Recife, não em UTC", () => {
    expect(edicoesNoAr([EU_AMO_CAFE], new Date("2026-11-16T01:00:00Z"))).toEqual([EU_AMO_CAFE]);
    expect(edicoesNoAr([EU_AMO_CAFE], new Date("2026-11-16T03:00:00Z"))).toEqual([]);
  });

  it("duas edições no ar ao mesmo tempo: as duas, a que termina primeiro antes", () => {
    expect(edicoesNoAr([RECIFE_COFFEE, EU_AMO_CAFE], meioDia("2026-11-10"))).toEqual([
      EU_AMO_CAFE,
      RECIFE_COFFEE,
    ]);
  });

  it("uma por festival: com a edição seguinte já publicada, fica a que termina primeiro", () => {
    const proxima = { ...EU_AMO_CAFE, id: "e3", ano: 2027, inicio: "2027-10-17", fim: "2027-11-14" };
    expect(edicoesNoAr([proxima, EU_AMO_CAFE], meioDia("2026-11-01"))).toEqual([EU_AMO_CAFE]);
    expect(edicoesNoAr([proxima, EU_AMO_CAFE], meioDia("2026-11-16"))).toEqual([proxima]);
  });
});

describe("participantesNoAr", () => {
  const comCafes = (edicao: Edicao, ...cafes: string[]): Edicao => ({
    ...edicao,
    participacoes: cafes.map((cafe_id, i) => ({
      id: `${edicao.id}-${i}`,
      cafe_id,
      numero: null,
      nome_combo: null,
      alt: null,
      instagram_url: null,
      arte: null,
    })),
  });

  it("os cafés de cada festival no ar, pelo slug", () => {
    const edicoes = [comCafes(EU_AMO_CAFE, "a", "b"), comCafes(RECIFE_COFFEE, "b", "c")];
    expect(participantesNoAr(edicoes, meioDia("2026-11-10"))).toEqual({
      "eu-amo-cafe": ["a", "b"],
      "recife-coffee": ["b", "c"],
    });
  });

  it("festival fora do ar não aparece; no ar sem participantes aparece vazio", () => {
    const edicoes = [comCafes(EU_AMO_CAFE), comCafes({ ...RECIFE_COFFEE, publicada: false }, "c")];
    expect(participantesNoAr(edicoes, meioDia("2026-10-10"))).toEqual({ "eu-amo-cafe": [] });
  });
});

describe("rotuloDeStatus", () => {
  it.each([
    ["2026-10-18", "Acontecendo agora · termina em 28 dias"],
    ["2026-11-13", "Acontecendo agora · termina em 2 dias"],
    ["2026-11-14", "Acontecendo agora · termina amanhã"],
    ["2026-11-15", "Acontecendo agora · último dia"],
    ["2026-11-16", "Edição encerrada"],
    ["2027-03-01", "Edição encerrada"],
    ["2026-10-01", "Começa em 18 out"],
  ])("em %s: %s", (dia, rotulo) => {
    expect(rotuloDeStatus(EU_AMO_CAFE, meioDia(dia))).toBe(rotulo);
  });

  it("conta os dias pelo dia de Recife: 14 nov às 23h em Recife ainda é 'termina amanhã'", () => {
    expect(rotuloDeStatus(EU_AMO_CAFE, new Date("2026-11-15T02:00:00Z"))).toBe("Acontecendo agora · termina amanhã");
  });
});

describe("periodoDaEdicao", () => {
  it("entre meses: '18 out a 15 nov 2026'", () => {
    expect(periodoDaEdicao(EU_AMO_CAFE)).toBe("18 out a 15 nov 2026");
  });

  it("no mesmo mês, o mês aparece uma vez: '3 a 28 mai 2026'", () => {
    expect(periodoDaEdicao({ inicio: "2026-05-03", fim: "2026-05-28" })).toBe("3 a 28 mai 2026");
  });

  it("entre anos, cada data leva o seu", () => {
    expect(periodoDaEdicao({ inicio: "2026-12-28", fim: "2027-01-05" })).toBe("28 dez 2026 a 5 jan 2027");
  });

  it("um dia só", () => {
    expect(periodoDaEdicao({ inicio: "2026-10-18", fim: "2026-10-18" })).toBe("18 out 2026");
  });
});

describe("formatarPreco", () => {
  it.each([
    [3490, "R$ 34,90"],
    [4590, "R$ 45,90"],
    [3000, "R$ 30,00"],
    [5, "R$ 0,05"],
    [123456, "R$ 1.234,56"],
  ])("%i centavos → %s", (centavos, texto) => {
    expect(formatarPreco(centavos)).toBe(texto);
  });
});

describe("ordenarPorNumero", () => {
  const p = (id: string, numero: number | null): Participacao => ({
    id,
    cafe_id: `cafe-${id}`,
    numero,
    nome_combo: null,
    alt: null,
    instagram_url: null,
    arte: null,
  });

  it("crescente pelo número do festival, sem número no fim, na ordem em que vieram", () => {
    const ordem = ordenarPorNumero([p("a", null), p("b", 13), p("c", 2), p("d", null), p("e", 7)]);
    expect(ordem.map(({ id }) => id)).toEqual(["c", "e", "b", "a", "d"]);
  });

  it("não altera a lista recebida", () => {
    const lista = [p("a", 2), p("b", 1)];
    ordenarPorNumero(lista);
    expect(lista.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});

describe("URLs", () => {
  it("página da edição: /festivais/{festival}/{ano}", () => {
    expect(urlDaEdicao(EU_AMO_CAFE)).toBe("/festivais/eu-amo-cafe/2026");
  });

  it("arte: caminho no bucket vira URL pública do festival-artes", () => {
    expect(urlPublicaDaArte("e1/abc.webp", "https://x.supabase.co/")).toBe(
      "https://x.supabase.co/storage/v1/object/public/festival-artes/e1/abc.webp",
    );
  });
});

it("é puro: não importa React, Supabase nem Mapbox", () => {
  const codigo = readFileSync(new URL("./festival.ts", import.meta.url), "utf8");
  expect(codigo).not.toMatch(/from ["'](react|@supabase\/[^"']*|mapbox-gl)["']/);
});

describe("combosDoCafe", () => {
  const participacao = (cafe_id: string, numero: number | null = 13): Participacao => ({
    id: `p-${cafe_id}`,
    cafe_id,
    numero,
    nome_combo: "Profiteroles + cappuccino",
    alt: null,
    instagram_url: null,
    arte: null,
  });
  const comKaffe = { ...EU_AMO_CAFE, participacoes: [participacao("outro", 2), participacao("kaffe")] };

  it("durante a edição, devolve o combo do café participante", () => {
    expect(combosDoCafe([comKaffe], "kaffe", meioDia("2026-10-20"))).toEqual([
      { edicao: comKaffe, participacao: participacao("kaffe") },
    ]);
  });

  it("quem não participa não tem combo", () => {
    expect(combosDoCafe([comKaffe], "versado", meioDia("2026-10-20"))).toEqual([]);
  });

  it.each(["2026-10-17", "2026-11-16"])("fora da edição (%s), nenhum combo", (dia) => {
    expect(combosDoCafe([comKaffe], "kaffe", meioDia(dia))).toEqual([]);
  });

  it("edição não publicada nunca mostra combo", () => {
    expect(combosDoCafe([{ ...comKaffe, publicada: false }], "kaffe", meioDia("2026-10-20"))).toEqual([]);
  });

  it("publicada mas antes do início, ainda sem combo (chip e selo já aparecem)", () => {
    expect(combosDoCafe([comKaffe], "kaffe", meioDia("2026-10-17"))).toEqual([]);
  });

  it("o dia é o de Recife: 15 nov às 22h ainda mostra o combo", () => {
    expect(combosDoCafe([comKaffe], "kaffe", new Date("2026-11-16T01:00:00Z"))).toHaveLength(1);
  });

  it("com duas edições ativas, um combo por edição, a que termina primeiro antes", () => {
    const recife = { ...RECIFE_COFFEE, participacoes: [participacao("kaffe", 4)] };
    const combos = combosDoCafe([recife, comKaffe], "kaffe", meioDia("2026-11-05"));
    expect(combos.map((c) => [c.edicao.festival.slug, c.participacao.numero])).toEqual([
      ["eu-amo-cafe", 13],
      ["recife-coffee", 4],
    ]);
  });
});

describe("ateODia", () => {
  it("último dia da edição, como na pílula do combo", () => {
    expect(ateODia(EU_AMO_CAFE)).toBe("até 15 nov");
  });
});

describe("tituloDoCombo", () => {
  it("com número, \"Combo 13\"", () => {
    expect(tituloDoCombo(EU_AMO_CAFE, { numero: 13 })).toBe("Combo 13");
  });

  it("sem número, o nome do festival", () => {
    expect(tituloDoCombo(EU_AMO_CAFE, { numero: null })).toBe("Combo do Eu Amo Café");
  });
});
