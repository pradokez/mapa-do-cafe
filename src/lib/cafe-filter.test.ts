import { describe, expect, it } from "vitest";

import type { Cafe } from "./cafe";

import {
  bairroChipLabel,
  bairrosDisponiveis,
  FILTROS_VAZIOS,
  filtrarCafes,
  parseFilters,
  serializeFilters,
  temFiltroAtivo,
  type CafeFilters,
} from "./cafe-filter";

function cafe(id: string, atributos: Partial<Cafe> = {}): Cafe {
  return {
    id,
    slug: id,
    nome: id,
    bairro: "Graças",
    bairro_slug: "gracas",
    endereco: "Rua X, 1",
    cidade: "Recife",
    lat: -8.05,
    lng: -34.9,
    selo_ascape: false,
    aceita_pets: false,
    tem_estacionamento: false,
    permite_coffee_office: false,
    faixa_preco: "$$",
    comodidades: [],
    horario_funcionamento: {
      segunda: "Fechado",
      terca: "Fechado",
      quarta: "Fechado",
      quinta: "Fechado",
      sexta: "Fechado",
      sabado: "Fechado",
      domingo: "Fechado",
    },
    instagram: null,
    telefone: null,
    fotos: [],
    ativo: true,
    ...atributos,
  };
}

const ids = (cafes: Cafe[]) => cafes.map((c) => c.id);

describe("filtrarCafes", () => {
  it("Aceita pets deixa só os cafés que aceitam pets", () => {
    const cafes = [cafe("a", { aceita_pets: true }), cafe("b"), cafe("c", { aceita_pets: true })];

    expect(ids(filtrarCafes(cafes, { ...FILTROS_VAZIOS, pets: true }))).toEqual(["a", "c"]);
  });

  it.each([
    ["ascape", "selo_ascape"],
    ["estacionamento", "tem_estacionamento"],
    ["coffeeOffice", "permite_coffee_office"],
  ] as const)("filtro %s deixa só os cafés com %s", (filtro, atributo) => {
    const cafes = [cafe("a"), cafe("b", { [atributo]: true }), cafe("c")];

    expect(ids(filtrarCafes(cafes, { ...FILTROS_VAZIOS, [filtro]: true }))).toEqual(["b"]);
  });

  it("filtros combinados retornam a interseção, não a união", () => {
    const cafes = [
      cafe("so-pets", { aceita_pets: true }),
      cafe("pets-e-office", { aceita_pets: true, permite_coffee_office: true }),
      cafe("so-office", { permite_coffee_office: true }),
    ];

    const filtrados = filtrarCafes(cafes, { ...FILTROS_VAZIOS, pets: true, coffeeOffice: true });

    expect(ids(filtrados)).toEqual(["pets-e-office"]);
  });

  it("sem filtro ligado devolve todos os cafés, na ordem recebida", () => {
    const cafes = [cafe("b"), cafe("a", { aceita_pets: true }), cafe("c")];

    expect(ids(filtrarCafes(cafes, FILTROS_VAZIOS))).toEqual(["b", "a", "c"]);
  });

  it("várias faixas de preço retornam a união das faixas", () => {
    const cafes = [
      cafe("barato", { faixa_preco: "$" }),
      cafe("medio", { faixa_preco: "$$" }),
      cafe("caro", { faixa_preco: "$$$" }),
    ];

    expect(ids(filtrarCafes(cafes, { ...FILTROS_VAZIOS, precos: ["$", "$$$"] }))).toEqual([
      "barato",
      "caro",
    ]);
  });

  it("vários bairros retornam a união, em interseção com o preço", () => {
    const cafes = [
      cafe("gracas-medio", { bairro_slug: "gracas", faixa_preco: "$$" }),
      cafe("espinheiro-barato", { bairro_slug: "espinheiro", faixa_preco: "$" }),
      cafe("espinheiro-medio", { bairro_slug: "espinheiro", faixa_preco: "$$" }),
      cafe("pina-medio", { bairro_slug: "pina", faixa_preco: "$$" }),
    ];

    const filtrados = filtrarCafes(cafes, {
      ...FILTROS_VAZIOS,
      bairros: ["gracas", "espinheiro"],
      precos: ["$$"],
    });

    expect(ids(filtrados)).toEqual(["gracas-medio", "espinheiro-medio"]);
  });

  it("filtro que todos atendem não exclui ninguém (Recife Coffee no lançamento)", () => {
    const cafes = [cafe("a", { selo_ascape: true }), cafe("b", { selo_ascape: true })];

    expect(ids(filtrarCafes(cafes, { ...FILTROS_VAZIOS, ascape: true }))).toEqual(["a", "b"]);
  });
});

describe("parseFilters", () => {
  it("lê cada param `=true` como filtro ligado", () => {
    const params = new URLSearchParams("ascape=true&pets=true&estacionamento=true&coffee_office=true");

    expect(parseFilters(params)).toEqual({
      ...FILTROS_VAZIOS,
      ascape: true,
      pets: true,
      estacionamento: true,
      coffeeOffice: true,
    });
  });

  it.each([
    ["ausente", ""],
    ["desconhecido", "foo=bar&wifi=true"],
    ["vazio", "pets=&ascape"],
    ["malformado", "pets=1&ascape=TRUE&estacionamento=sim&coffee_office=false"],
    ["com codificação estranha", "pets=%E0%A4%A&coffee_office=tru%65%"],
  ])("param %s é ignorado em silêncio: filtro desligado", (_, query) => {
    expect(parseFilters(new URLSearchParams(query))).toEqual(FILTROS_VAZIOS);
  });

  it("lê `preco` em ordem canônica, sem repetição e sem valor inválido", () => {
    const params = new URLSearchParams("preco=$$$,$,x,$$$$,,$");

    expect(parseFilters(params).precos).toEqual(["$", "$$$"]);
  });

  it("lê `bairro` como slugs em ordem alfabética, sem repetição", () => {
    const params = new URLSearchParams("bairro=pina,gracas,,pina");

    expect(parseFilters(params).bairros).toEqual(["gracas", "pina"]);
  });

  it("com a lista de bairros válidos, slug desconhecido é ignorado em silêncio", () => {
    const validos = ["espinheiro", "gracas"];

    expect(parseFilters(new URLSearchParams("bairro=gracas,nao-existe"), validos).bairros).toEqual([
      "gracas",
    ]);
    expect(parseFilters(new URLSearchParams("bairro=nao-existe"), validos)).toEqual(FILTROS_VAZIOS);
  });

  it("param desconhecido não atrapalha os conhecidos", () => {
    const params = new URLSearchParams("utm_source=instagram&pets=true&ordem=nome");

    expect(parseFilters(params)).toEqual({ ...FILTROS_VAZIOS, pets: true });
  });
});

describe("serializeFilters", () => {
  it("emite só os filtros ligados, como `param=true`", () => {
    const params = serializeFilters({ ...FILTROS_VAZIOS, pets: true, coffeeOffice: true });

    expect(params).toBe("pets=true&coffee_office=true");
  });

  it("emite `bairro` e `preco` legíveis, em ordem canônica, seja qual for a ordem dos cliques", () => {
    const params = serializeFilters({
      ...FILTROS_VAZIOS,
      bairros: ["gracas", "espinheiro"],
      precos: ["$$", "$"],
    });

    expect(params).toBe("bairro=espinheiro,gracas&preco=$,$$");
  });

  it("sem filtro ligado não emite nada", () => {
    expect(serializeFilters(FILTROS_VAZIOS)).toBe("");
  });

  it("sobre params existentes, preserva os alheios e reescreve só os de filtro", () => {
    const atual = new URLSearchParams("utm_source=instagram&pets=1&ascape=true");

    const params = serializeFilters({ ...FILTROS_VAZIOS, pets: true }, atual);

    expect(params).toBe("utm_source=instagram&pets=true");
    expect(atual.toString()).toBe("utm_source=instagram&pets=1&ascape=true");
  });

  // As 16 combinações dos 4 booleanos.
  const combinacoes: CafeFilters[] = Array.from({ length: 16 }, (_, i) => ({
    ...FILTROS_VAZIOS,
    ascape: Boolean(i & 1),
    pets: Boolean(i & 2),
    estacionamento: Boolean(i & 4),
    coffeeOffice: Boolean(i & 8),
  }));

  it.each<Partial<CafeFilters>>([
    { precos: ["$"] },
    { precos: ["$", "$$", "$$$"] },
    { bairros: ["gracas"] },
    { bairros: ["boa-viagem", "espinheiro", "gracas"], precos: ["$$"], pets: true },
  ])("ida e volta com bairro e preço é estável: %o", (parcial) => {
    const filters = { ...FILTROS_VAZIOS, ...parcial };

    expect(parseFilters(new URLSearchParams(serializeFilters(filters)))).toEqual(filters);
  });

  it.each(combinacoes)("ida e volta estado → params → estado é estável: %o", (filters) => {
    expect(parseFilters(new URLSearchParams(serializeFilters(filters)))).toEqual(filters);
  });
});

describe("temFiltroAtivo", () => {
  it("é falso sem filtro e verdadeiro com qualquer filtro ligado", () => {
    expect(temFiltroAtivo(FILTROS_VAZIOS)).toBe(false);
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, estacionamento: true })).toBe(true);
  });

  it("bairro ou preço marcado também conta como filtro ativo", () => {
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, bairros: ["gracas"] })).toBe(true);
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, precos: ["$"] })).toBe(true);
  });
});

describe("bairrosDisponiveis", () => {
  it("lista cada bairro uma vez, em ordem alfabética pt-BR (acento não joga para o fim)", () => {
    const cafes = [
      cafe("a", { bairro: "Várzea", bairro_slug: "varzea" }),
      cafe("b", { bairro: "Graças", bairro_slug: "gracas" }),
      cafe("c", { bairro: "Tamarineira", bairro_slug: "tamarineira" }),
      cafe("d", { bairro: "Graças", bairro_slug: "gracas" }),
      cafe("e", { bairro: "Zumbi", bairro_slug: "zumbi" }),
    ];

    expect(bairrosDisponiveis(cafes)).toEqual([
      { slug: "gracas", nome: "Graças" },
      { slug: "tamarineira", nome: "Tamarineira" },
      { slug: "varzea", nome: "Várzea" },
      { slug: "zumbi", nome: "Zumbi" },
    ]);
  });
});

describe("bairroChipLabel", () => {
  const bairros = [
    { slug: "espinheiro", nome: "Espinheiro" },
    { slug: "gracas", nome: "Graças" },
  ];

  it("sem seleção: Bairro; um: o nome dele; vários: N bairros", () => {
    expect(bairroChipLabel([], bairros)).toBe("Bairro");
    expect(bairroChipLabel(["gracas"], bairros)).toBe("Graças");
    expect(bairroChipLabel(["espinheiro", "gracas"], bairros)).toBe("2 bairros");
  });
});
