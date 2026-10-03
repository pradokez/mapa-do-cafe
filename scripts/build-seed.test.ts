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

  it("carrega os 29 cafés: 27 ativos, 3 em Olinda, ids e slugs únicos", () => {
    const todos = cafes();

    expect(todos).toHaveLength(29);
    expect(new Set(todos.map((c) => c.id)).size).toBe(29);
    expect(new Set(todos.map((c) => c.slug)).size).toBe(29);
    expect(todos.filter((c) => c.ativo)).toHaveLength(27);
    expect(todos.filter((c) => !c.ativo).map((c) => c.slug).sort()).toEqual([
      "castigliani",
      "versado-derby",
    ]);
    expect(todos.filter((c) => c.cidade === "Olinda")).toHaveLength(3);
  });

  it("todo café tem coordenadas dentro de Recife/Olinda", () => {
    const fora = cafes().filter(
      ({ lat, lng }) => !(lat > -8.2 && lat < -7.95 && lng > -35.05 && lng < -34.8),
    );

    expect(fora.map((c) => c.slug)).toEqual([]);
  });

  it("todo café tem os 7 dias de horário, cada um 'Fechado' ou turnos 'HH:MM – HH:MM'", () => {
    const turno = "\\d{2}:\\d{2} – \\d{2}:\\d{2}";
    const valido = new RegExp(`^(Fechado|${turno}(, ${turno})*)$`);
    const dias = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

    for (const { slug, horario_funcionamento: h } of cafes()) {
      expect(Object.keys(h).sort(), slug).toEqual([...dias].sort());
      for (const dia of dias) expect(h[dia as keyof typeof h], `${slug}.${dia}`).toMatch(valido);
    }
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
