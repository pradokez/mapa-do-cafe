import type { MetadataRoute } from "next";

import { caminhoDoCafe } from "@/lib/cafe";
import { listCafesAtivos, listFestivais } from "@/lib/cafe-repository";
import { urlDaEdicao } from "@/lib/festival";
import { siteUrl } from "@/lib/site-url.mjs";

// Como a home: lido a cada request, mas do cache de `listCafesAtivos` — café
// desativado sai do sitemap quando esse cache vira. As edições dos festivais
// entram enquanto publicadas (futura, ativa ou encerrada: todas abrem). Sem `lastModified`: o
// `Cafe` não carrega `atualizado_em`, e a data do build mentiria.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [cafes, edicoes] = await Promise.all([listCafesAtivos(), listFestivais()]);
  return [
    { url: new URL("/", base).href },
    ...cafes.map((cafe) => ({ url: new URL(caminhoDoCafe(cafe), base).href })),
    ...edicoes.map((edicao) => ({ url: new URL(urlDaEdicao(edicao), base).href })),
  ];
}
