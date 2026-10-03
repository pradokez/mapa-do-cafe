import type { MetadataRoute } from "next";

import { listCafesAtivos } from "@/lib/cafe-repository";
import { siteUrl } from "@/lib/site-url";

// Como a home: lido a cada request, mas do cache de `listCafesAtivos` — café
// desativado sai do sitemap quando esse cache vira. Sem `lastModified`: o
// `Cafe` não carrega `atualizado_em`, e a data do build mentiria.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const cafes = await listCafesAtivos();
  return [
    { url: new URL("/", base).href },
    ...cafes.map((cafe) => ({ url: new URL(`/cafes/${cafe.slug}`, base).href })),
  ];
}
