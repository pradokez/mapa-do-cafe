import { describe, expect, it } from "vitest";

import { redirectsParaCanonico, siteUrl } from "./site-url.mjs";

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

describe("redirectsParaCanonico", () => {
  const producao = { VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://mapa.example" };

  it("em produção, manda o host .vercel.app para o domínio canônico, mantendo o caminho", () => {
    expect(redirectsParaCanonico(producao)).toEqual([
      expect.objectContaining({ source: "/:path*", destination: "https://mapa.example/:path*", permanent: true }),
    ]);
  });

  it("fora de produção (preview, local), não redireciona: os previews continuam acessíveis", () => {
    expect(redirectsParaCanonico({ ...producao, VERCEL_ENV: "preview" })).toEqual([]);
    expect(redirectsParaCanonico({ NEXT_PUBLIC_SITE_URL: "https://mapa.example" })).toEqual([]);
  });

  it("sem domínio próprio (a origem é ela mesma .vercel.app), não redireciona — seria um loop", () => {
    expect(redirectsParaCanonico({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "mapa.vercel.app" })).toEqual([]);
  });

  it("só casa hosts da Vercel, nunca o próprio domínio canônico", () => {
    const [redirect] = redirectsParaCanonico(producao);
    // O Next ancora o `value` do `has` no host inteiro.
    const casa = (host: string) => new RegExp(`^(?:${redirect.has[0].value})$`).test(host);
    expect(casa("mapa-do-cafe-pradokezs-projects.vercel.app")).toBe(true);
    expect(casa("mapa-do-cafe-f6yo66ipf-pradokezs-projects.vercel.app")).toBe(true);
    expect(casa("mapa.example")).toBe(false);
    expect(casa("vercel.app.mapa.example")).toBe(false);
  });
});
