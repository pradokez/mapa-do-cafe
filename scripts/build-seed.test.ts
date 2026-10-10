import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CAFE_COLUMNS, type Cafe } from "../src/lib/cafe";
import { CIDADES, dentroDaRegiao, FAIXAS, slugify, validarHorarioDia } from "../src/lib/cafe-dados";
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

  // O JSON é um retrato da produção (`pnpm seed:pull`): as regras valem para
  // qualquer quantidade de cafés, sem contagem fixa que quebre a cada café novo.
  it("ids e slugs são únicos, e há pelo menos um café no ar (um pull quebrado não passa)", () => {
    const todos = cafes();

    expect(new Set(todos.map((c) => c.id)).size).toBe(todos.length);
    expect(new Set(todos.map((c) => c.slug)).size).toBe(todos.length);
    expect(todos.some((c) => c.ativo)).toBe(true);
  });

  it("cidade e faixa de preço só têm os valores que o banco aceita", () => {
    for (const cafe of cafes()) {
      expect(CIDADES, cafe.slug).toContain(cafe.cidade);
      expect(FAIXAS, cafe.slug).toContain(cafe.faixa_preco);
    }
  });

  it("bairro_slug sai do bairro, pela mesma regra do admin (senão o filtro ganha bairro duplicado)", () => {
    for (const cafe of cafes()) expect(cafe.bairro_slug, cafe.slug).toBe(slugify(cafe.bairro));
  });

  it("fotos ficam vazias no retrato: o arquivo só existe no bucket da produção", () => {
    expect(cafes().filter((c) => c.fotos.length > 0).map((c) => c.slug)).toEqual([]);
  });

  it("todo café tem coordenadas dentro da região de Recife, Olinda e Jaboatão", () => {
    const fora = cafes().filter((cafe) => !dentroDaRegiao(cafe));

    expect(fora.map((c) => c.slug)).toEqual([]);
  });

  it("todo café tem os 7 dias de horário, cada um 'Fechado' ou turnos 'HH:MM – HH:MM' (regra do admin)", () => {
    const dias = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

    for (const { slug, horario_funcionamento: h } of cafes()) {
      expect(Object.keys(h).sort(), slug).toEqual([...dias].sort());
      for (const dia of dias) expect(validarHorarioDia(h[dia as keyof typeof h]), `${slug}.${dia}`).toBeNull();
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

  it("ar-condicionado é true, false ou null (sem informação); os outros booleanos nunca são null", () => {
    for (const cafe of cafes()) {
      expect([true, false, null], cafe.slug).toContain(cafe.tem_ar_condicionado);
      expect(typeof cafe.acessivel_pcd, cafe.slug).toBe("boolean");
      expect(typeof cafe.opcoes_vegetarianas, cafe.slug).toBe("boolean");
      expect(typeof cafe.selo_eu_amo_cafe, cafe.slug).toBe("boolean");
    }
  });

  it("cada café do JSON tem exatamente as colunas de `Cafe` — chave a mais seria ignorada em silêncio", () => {
    const cafes: Record<string, unknown>[] = JSON.parse(read("supabase/seed/cafes.json"));
    const colunas = [...CAFE_COLUMNS].sort();

    for (const cafe of cafes) {
      expect(Object.keys(cafe).sort(), String(cafe.slug)).toEqual(colunas);
    }
  });

  it("reaplicar o seed nunca altera café existente: só insere os que faltam (a produção é a fonte da verdade)", () => {
    const sql = buildSeedSql("[]");

    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).not.toMatch(/do update/i);
  });

  it("recusa JSON que fecharia o literal do SQL antes da hora", () => {
    expect(() => buildSeedSql('[{"nome": "$seed$; drop table cafes; --"}]')).toThrow();
  });
});
