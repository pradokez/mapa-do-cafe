import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CAFE_COLUMNS, type Cafe } from "../src/lib/cafe";
import { buildSeedSql } from "./build-seed";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("seed do Supabase", () => {
  it("supabase/seed.sql está em sincronia com supabase/seed/cafes.json (rode `pnpm seed:build`)", () => {
    expect(read("supabase/seed.sql")).toBe(
      buildSeedSql(read("supabase/seed/cafes.json")),
    );
  });

  it("carrega os 29 cafés da issue #3: 27 ativos, 3 em Olinda, ids e slugs únicos", () => {
    const cafes: Cafe[] = JSON.parse(read("supabase/seed/cafes.json"));

    expect(cafes).toHaveLength(29);
    expect(new Set(cafes.map((c) => c.id)).size).toBe(29);
    expect(new Set(cafes.map((c) => c.slug)).size).toBe(29);
    expect(cafes.filter((c) => c.ativo)).toHaveLength(27);
    expect(cafes.filter((c) => !c.ativo).map((c) => c.slug).sort()).toEqual([
      "castigliani",
      "versado-derby",
    ]);
    expect(cafes.filter((c) => c.cidade === "Olinda")).toHaveLength(3);
  });

  it("cada café do JSON tem exatamente as colunas de `Cafe` — chave a mais seria ignorada em silêncio", () => {
    const cafes: Record<string, unknown>[] = JSON.parse(read("supabase/seed/cafes.json"));
    const colunas = [...CAFE_COLUMNS].sort();

    for (const cafe of cafes) {
      expect(Object.keys(cafe).sort(), String(cafe.slug)).toEqual(colunas);
    }
  });

  it("recusa JSON que fecharia o literal do SQL antes da hora", () => {
    expect(() => buildSeedSql('[{"nome": "$seed$; drop table cafes; --"}]')).toThrow();
  });
});
