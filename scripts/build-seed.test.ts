import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe } from "../src/lib/cafe";
import { distanciaKm } from "../src/lib/cafe-distance";
import { buildSeedSql } from "./build-seed";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const cafes = (): Cafe[] => JSON.parse(read("supabase/seed/cafes.json"));

// Cafés reais no mesmo endereço (Várzea) têm as coordenadas afastadas de
// propósito: com 30 m, os pins se separam no zoom máximo do mapa.
const MIN_ENTRE_PINS_KM = 0.03;

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

  it("nenhum café ativo fica a menos de 30 m de outro: um pin esconderia o outro no mapa", () => {
    const ativos = cafes().filter((c) => c.ativo);
    const colados = ativos.flatMap((a, i) =>
      ativos
        .slice(i + 1)
        .filter((b) => distanciaKm(a, b)! < MIN_ENTRE_PINS_KM)
        .map((b) => `${a.slug} × ${b.slug}`),
    );

    expect(colados).toEqual([]);
  });

  it("recusa JSON que fecharia o literal do SQL antes da hora", () => {
    expect(() => buildSeedSql('[{"nome": "$seed$; drop table cafes; --"}]')).toThrow();
  });
});
