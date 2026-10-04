// `.mjs`, não `.ts`: o `next.config.mjs` também usa (redirect do `.vercel.app`),
// e o Node não importa TypeScript. Os tipos vêm do JSDoc.

/** @typedef {Partial<Record<string, string>>} Env */

/**
 * Origem das URLs absolutas (canonical, sitemap, JSON-LD). `NEXT_PUBLIC_SITE_URL`
 * manda; sem ela, o domínio de produção que a Vercel injeta (inclusive nos
 * previews, para o canonical nunca apontar para um deploy descartável); fora da
 * Vercel, o servidor local.
 *
 * @param {Env} [env]
 * @returns {URL}
 */
export function siteUrl(env = process.env) {
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}

/**
 * Redirects do `next.config.mjs` (#50): em produção, qualquer host `*.vercel.app`
 * vai para o domínio canônico por 308, mantendo caminho e query. Previews ficam
 * de fora (seguem atrás do SSO da Vercel), e sem domínio próprio não há para
 * onde ir — o canônico seria o próprio `.vercel.app`, e o redirect, um loop.
 *
 * @param {Env} [env]
 */
export function redirectsParaCanonico(env = process.env) {
  const canonico = siteUrl(env);
  if (env.VERCEL_ENV !== "production" || canonico.hostname.endsWith(".vercel.app")) return [];
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: ".*\\.vercel\\.app" }],
      destination: `${canonico.origin}/:path*`,
      permanent: true,
    },
  ];
}
