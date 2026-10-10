import { describe, expect, it } from "vitest";

import { CAFE_COLUMNS } from "../src/lib/cafe";
import { DIAS_DA_SEMANA } from "../src/lib/cafe-hours";
import { retratoDosCafes } from "./pull-seed";

// Uma linha como o `db query -o json` devolve: chaves em ordem alfabética,
// inclusive as do `jsonb`, e colunas técnicas que o `Cafe` não tem.
function linha(slug: string, extra: Record<string, unknown> = {}) {
  const cafe: Record<string, unknown> = {
    id: `id-${slug}`,
    slug,
    nome: slug,
    bairro: "Graças",
    bairro_slug: "gracas",
    endereco: "R. X, 1",
    cidade: "Recife",
    lat: -8.05,
    lng: -34.9,
    selo_ascape: true,
    selo_eu_amo_cafe: false,
    aceita_pets: false,
    tem_estacionamento: false,
    permite_coffee_office: false,
    acessivel_pcd: false,
    opcoes_vegetarianas: false,
    tem_ar_condicionado: null,
    faixa_preco: "$$",
    horario_funcionamento: Object.fromEntries([...DIAS_DA_SEMANA].sort().map((d) => [d, "08:00 – 18:00"])),
    instagram: null,
    telefone: null,
    fotos: [`id-${slug}/foto.webp`],
    ativo: true,
    atualizado_em: "2026-10-09T12:00:00Z",
    criado_em: "2026-10-01T12:00:00Z",
    location: "0101000020E6100000",
    ...extra,
  };
  return Object.fromEntries(Object.entries(cafe).sort(([a], [b]) => a.localeCompare(b)));
}

const ler = (texto: string): Record<string, unknown>[] => JSON.parse(texto);

describe("retrato dos cafés da produção (pnpm seed:pull)", () => {
  it("cada café sai só com as colunas de `Cafe`, na ordem de CAFE_COLUMNS", () => {
    const [cafe] = ler(retratoDosCafes([linha("a")]));

    expect(Object.keys(cafe)).toEqual([...CAFE_COLUMNS]);
  });

  it("o horário sai de segunda a domingo, não na ordem em que o jsonb devolve", () => {
    const [cafe] = ler(retratoDosCafes([linha("a")]));

    expect(Object.keys(cafe.horario_funcionamento as object)).toEqual([...DIAS_DA_SEMANA]);
  });

  it("fotos saem sempre vazias: o arquivo só existe no bucket, e o trigger ignora o valor", () => {
    const [cafe] = ler(retratoDosCafes([linha("a")]));

    expect(cafe.fotos).toEqual([]);
  });

  it("ordena por slug, para um pull sem mudança não gerar diff", () => {
    const slugs = ler(retratoDosCafes([linha("zoco"), linha("81-coffee"), linha("cafe-b"), linha("cafe-a")])).map((c) => c.slug);

    expect(slugs).toEqual(["81-coffee", "cafe-a", "cafe-b", "zoco"]);
  });

  it("inclui os cafés fora do ar e mantém os valores como vieram", () => {
    const [cafe] = ler(retratoDosCafes([linha("a", { ativo: false, tem_ar_condicionado: true, faixa_preco: "$" })]));

    expect(cafe).toMatchObject({ ativo: false, tem_ar_condicionado: true, faixa_preco: "$" });
  });

  it("é estável: o retrato de um retrato é o mesmo texto, no formato do arquivo (2 espaços e quebra final)", () => {
    const retrato = retratoDosCafes([linha("b"), linha("a")]);

    expect(retratoDosCafes(ler(retrato))).toBe(retrato);
    expect(retrato).toBe(`${JSON.stringify(ler(retrato), null, 2)}\n`);
  });

  it("recusa resposta vazia ou que não é lista: um pull quebrado não apaga o arquivo", () => {
    expect(() => retratoDosCafes([])).toThrow();
    expect(() => retratoDosCafes({ rows: [] })).toThrow();
  });

  it("recusa linha que não é um café", () => {
    expect(() => retratoDosCafes([null])).toThrow();
    expect(() => retratoDosCafes(["81-coffee"])).toThrow();
  });

  it("dia fora da semana não some: vai para o fim, e o teste do seed acusa", () => {
    const [cafe] = ler(retratoDosCafes([linha("a", { horario_funcionamento: { feriado: "Fechado", terca: "08:00 – 18:00", segunda: "Fechado" } })]));

    expect(Object.keys(cafe.horario_funcionamento as object)).toEqual(["segunda", "terca", "feriado"]);
  });

  it("recusa café sem alguma coluna, citando o slug", () => {
    const { telefone: _, ...semTelefone } = linha("sem-telefone");

    expect(() => retratoDosCafes([semTelefone])).toThrow(/sem-telefone.*telefone/);
  });
});
