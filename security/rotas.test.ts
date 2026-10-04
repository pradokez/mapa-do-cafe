import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Cafe } from "@/lib/cafe";

import { APP_URL } from "./env";

/**
 * Status HTTP do detalhe (#72): café inativo ou inexistente é 404 de verdade,
 * não a UI de não-encontrado com 200 (soft-404, indexável). Só leitura: roda
 * contra o descartável ou contra produção (`SECURITY_APP_URL`). Os slugs vêm do
 * seed — em produção, o admin pode ter mudado o status de algum.
 */

const suite = APP_URL ? describe : describe.skip;
if (!APP_URL) console.warn("[security] Status das rotas pulado: defina SECURITY_APP_URL");

const seed: Cafe[] = JSON.parse(readFileSync(new URL("../supabase/seed/cafes.json", import.meta.url), "utf8"));
const ativo = seed.find((c) => c.ativo)!.slug;
const inativo = seed.find((c) => !c.ativo)!.slug;

async function status(caminho: string): Promise<number> {
  return (await fetch(`${APP_URL}${caminho}`, { redirect: "manual" })).status;
}

suite("status HTTP de /cafes/[slug]", () => {
  it("café ativo → 200", async () => {
    expect(await status(`/cafes/${ativo}`)).toBe(200);
  });

  it("café inativo → 404", async () => {
    expect(await status(`/cafes/${inativo}`)).toBe(404);
  });

  it("slug inexistente → 404", async () => {
    expect(await status("/cafes/zzz-nao-existe-123")).toBe(404);
  });
});
