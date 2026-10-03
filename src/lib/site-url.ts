type Env = Partial<Record<string, string>>;

/**
 * Origem das URLs absolutas (canonical, sitemap, JSON-LD). `NEXT_PUBLIC_SITE_URL`
 * manda; sem ela, o domínio de produção que a Vercel injeta (inclusive nos
 * previews, para o canonical nunca apontar para um deploy descartável); fora da
 * Vercel, o servidor local.
 */
export function siteUrl(env: Env = process.env): URL {
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}
