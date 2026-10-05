import { describe, expect, it } from "vitest";

import { escritaDoAdmin } from "./admin-escrita";

describe("escritaDoAdmin", () => {
  it("na produção da Vercel, a escrita é liberada", () => {
    expect(escritaDoAdmin({ VERCEL_ENV: "production" })).toEqual({ liberada: true });
  });

  it.each([
    ["no preview da Vercel (que também aponta para a produção)", { VERCEL_ENV: "preview" }],
    ["no development da Vercel", { VERCEL_ENV: "development" }],
    ["fora da Vercel (pnpm dev, next start)", {}],
  ])("bloqueia %s, dizendo como liberar", (_, env) => {
    const escrita = escritaDoAdmin(env);
    expect(escrita.liberada).toBe(false);
    if (!escrita.liberada) expect(escrita.motivo).toContain("ADMIN_ESCRITA_LIBERADA=1");
  });

  it.each([{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, {}, { VERCEL_ENV: "production" }])(
    "ADMIN_ESCRITA_LIBERADA=1 libera em qualquer ambiente (%o)",
    (env) => {
      expect(escritaDoAdmin({ ...env, ADMIN_ESCRITA_LIBERADA: "1" })).toEqual({ liberada: true });
    },
  );

  it.each(["true", "0", "", " 1", "1 ", "yes"])("ADMIN_ESCRITA_LIBERADA=%j não libera: só o valor 1", (valor) => {
    expect(escritaDoAdmin({ ADMIN_ESCRITA_LIBERADA: valor }).liberada).toBe(false);
  });
});
