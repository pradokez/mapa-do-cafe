import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cafe } from "./cafe.fixture";
import { resolveCafePhotos } from "./cafe-photos";
import {
  ateODia,
  bairroDoParam,
  bairrosDosCombos,
  combosDaEdicao,
  combosDoCafe,
  edicaoDaPagina,
  edicoesNoAr,
  estadoDaEdicao,
  fonteDaArte,
  formatarPreco,
  ordenarPorNumero,
  participantesNoAr,
  rotuloDeCombos,
  rotuloDeParticipantes,
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
    ["2026-10-01", "Em breve · começa em 17 dias"],
    ["2026-10-16", "Em breve · começa em 2 dias"],
    ["2026-10-17", "Em breve · começa amanhã"],
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

describe("edicaoDaPagina", () => {
  const edicoes = [EU_AMO_CAFE, RECIFE_COFFEE];

  it("acha a edição pelo festival e pelo ano, ativa durante o período", () => {
    expect(edicaoDaPagina(edicoes, "eu-amo-cafe", "2026", meioDia("2026-10-20"))).toMatchObject({
      edicao: EU_AMO_CAFE,
      estado: "ativa",
    });
  });

  it("publicada e ainda por começar abre, como futura (decisão de 10/10/2026, #101)", () => {
    expect(edicaoDaPagina(edicoes, "eu-amo-cafe", "2026", meioDia("2026-10-17"))?.estado).toBe("futura");
  });

  it("encerrada continua abrindo, com o estado", () => {
    expect(edicaoDaPagina(edicoes, "eu-amo-cafe", "2026", meioDia("2026-11-16"))?.estado).toBe("encerrada");
  });

  it("na encerrada, aponta a edição no ar do mesmo festival — futura ou ativa", () => {
    const ed2025 = { ...EU_AMO_CAFE, id: "e0", ano: 2025, inicio: "2025-10-18", fim: "2025-11-15" };
    const todas = [ed2025, EU_AMO_CAFE, RECIFE_COFFEE];
    expect(edicaoDaPagina(todas, "eu-amo-cafe", "2025", meioDia("2026-10-01"))?.noAr).toBe(EU_AMO_CAFE);
    expect(edicaoDaPagina(todas, "eu-amo-cafe", "2025", meioDia("2026-10-20"))?.noAr).toBe(EU_AMO_CAFE);
    // Depois de 2026 acabar, não há edição do Eu Amo Café no ar.
    expect(edicaoDaPagina(todas, "eu-amo-cafe", "2025", meioDia("2026-11-20"))?.noAr).toBeNull();
    // Rascunho não conta.
    const rascunho = { ...EU_AMO_CAFE, publicada: false };
    expect(edicaoDaPagina([ed2025, rascunho], "eu-amo-cafe", "2025", meioDia("2026-10-20"))?.noAr).toBeNull();
  });

  it.each([
    ["de outro ano", "eu-amo-cafe", "2025", "2026-10-20"],
    ["de festival desconhecido", "outro", "2026", "2026-10-20"],
    ["com o ano malformado", "eu-amo-cafe", "2026abc", "2026-10-20"],
    ["com o ano com zero à esquerda", "eu-amo-cafe", "02026", "2026-10-20"],
  ])("edição %s → null (404)", (_, festival, ano, dia) => {
    expect(edicaoDaPagina(edicoes, festival, ano, meioDia(dia))).toBeNull();
  });

  it("não publicada → null, mesmo dentro do período", () => {
    const rascunho = { ...EU_AMO_CAFE, publicada: false };
    expect(edicaoDaPagina([rascunho], "eu-amo-cafe", "2026", meioDia("2026-10-20"))).toBeNull();
  });
});

describe("combosDaEdicao", () => {
  const part = (cafe_id: string, numero: number | null): Participacao => ({
    id: `p-${cafe_id}`,
    cafe_id,
    numero,
    nome_combo: null,
    alt: null,
    instagram_url: null,
    arte: null,
  });

  it("cada participação com o seu café, na ordem do número", () => {
    const edicao = { ...EU_AMO_CAFE, participacoes: [part("b", 7), part("a", null), part("c", 2)] };
    const combos = combosDaEdicao(edicao, [cafe("a"), cafe("b"), cafe("c")]);
    expect(combos.map(({ cafe, participacao }) => [cafe.id, participacao.numero])).toEqual([
      ["c", 2],
      ["b", 7],
      ["a", null],
    ]);
  });

  it("participação de café que não está na lista (fora do ar) fica de fora", () => {
    const edicao = { ...EU_AMO_CAFE, participacoes: [part("a", 1), part("sumiu", 2)] };
    expect(combosDaEdicao(edicao, [cafe("a")]).map(({ cafe }) => cafe.id)).toEqual(["a"]);
  });
});

describe("filtro de bairro", () => {
  const combo = (id: string, bairro: string, bairro_slug: string) => ({
    participacao: { id, cafe_id: id, numero: null, nome_combo: null, alt: null, instagram_url: null, arte: null },
    cafe: cafe(id, { bairro, bairro_slug }),
  });
  const combos = [
    combo("a", "Graças", "gracas"),
    combo("b", "Boa Viagem", "boa-viagem"),
    combo("c", "Graças", "gracas"),
    combo("d", "Água Fria", "agua-fria"),
  ];

  it("os bairros dos participantes, sem repetir, em ordem alfabética sem acento", () => {
    expect(bairrosDosCombos(combos)).toEqual([
      { slug: "agua-fria", nome: "Água Fria" },
      { slug: "boa-viagem", nome: "Boa Viagem" },
      { slug: "gracas", nome: "Graças" },
    ]);
  });

  it("param de um bairro dos participantes vale; desconhecido, vazio ou ausente é ignorado", () => {
    const bairros = bairrosDosCombos(combos);
    expect(bairroDoParam("gracas", bairros)).toBe("gracas");
    expect(bairroDoParam("espinheiro", bairros)).toBeNull();
    expect(bairroDoParam("", bairros)).toBeNull();
    expect(bairroDoParam(null, bairros)).toBeNull();
    expect(bairroDoParam(undefined, bairros)).toBeNull();
  });
});

describe("contadores", () => {
  it.each([
    [1, "1 combo", "1 café participante"],
    [0, "0 combos", "0 cafés participantes"],
    [18, "18 combos", "18 cafés participantes"],
  ])("%i → '%s' e '%s'", (n, combos, participantes) => {
    expect(rotuloDeCombos(n)).toBe(combos);
    expect(rotuloDeParticipantes(n)).toBe(participantes);
  });
});

describe("fonteDaArte", () => {
  const participacao: Participacao = {
    id: "p",
    cafe_id: "a",
    numero: 1,
    nome_combo: null,
    alt: "Combo 1",
    instagram_url: null,
    arte: "https://x.supabase.co/storage/v1/object/public/festival-artes/e1/a.webp",
  };

  it("com arte, a URL dela", () => {
    expect(fonteDaArte({ participacao, cafe: cafe("a") })).toEqual({ kind: "url", src: participacao.arte });
  });

  it("sem arte, o placeholder listrado do café — o mesmo do card dele", () => {
    const fonte = fonteDaArte({ participacao: { ...participacao, arte: null }, cafe: cafe("a") });
    const [doCard] = resolveCafePhotos(cafe("a"));
    expect(fonte).toEqual(doCard);
  });
});
