import { describe, expect, it } from "vitest";

import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("usa NEXT_PUBLIC_SITE_URL quando definida", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://mapa.example" }).href).toBe("https://mapa.example/");
  });

  it("tem precedência sobre o domínio de produção da Vercel", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "https://mapa.example", VERCEL_PROJECT_PRODUCTION_URL: "mapa.vercel.app" };
    expect(siteUrl(env).href).toBe("https://mapa.example/");
  });

  it("sem a variável, usa o domínio de produção da Vercel (que vem sem protocolo)", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "mapa.vercel.app" }).href).toBe("https://mapa.vercel.app/");
  });

  it("variável vazia conta como ausente", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "mapa.vercel.app" };
    expect(siteUrl(env).href).toBe("https://mapa.vercel.app/");
  });

  it("fora da Vercel e sem a variável, cai no servidor local", () => {
    expect(siteUrl({}).href).toBe("http://localhost:3000/");
  });
});
