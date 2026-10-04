import { redirectsParaCanonico } from "./src/lib/site-url.mjs";
import { SLUGS_ANTIGOS } from "./src/lib/slugs-antigos.mjs";

/**
 * Headers de segurança de todo o site (#59). Sem `script-src`/nonce: no Next 14
 * exigiria middleware em toda rota (custo e latência em cada visita) e o Mapbox
 * precisa de `worker-src blob:` — contra XSS, a defesa segue sendo o React
 * escapar tudo e o JSON-LD escapado no detalhe. HSTS já vem da Vercel. Ver
 * docs/security/pentest-2026-10.md.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
];

/**
 * Headers só do admin (#43): fora de busca e fora de cache. Somam-se aos de
 * segurança, que já cobrem iframe e referrer (`strict-origin-when-cross-origin`
 * não vaza o caminho — com o id do café — para fora do site). Não repetem
 * nenhuma chave de `SECURITY_HEADERS`: o Next emitiria o header duas vezes.
 * Valem também para o redirect do middleware.
 */
const ADMIN_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Não anuncia a stack (fingerprinting): remove `X-Powered-By: Next.js`.
  poweredByHeader: false,
  // #52: as fotos já chegam em WebP redimensionado do upload (#46) e vão
  // direto do Supabase ao navegador. Nenhuma imagem passa por `/_next/image`
  // (nem conta no bandwidth da Vercel), e não é preciso listar o host.
  images: { unoptimized: true },
  experimental: {
    // Fontes das imagens de compartilhamento (#49), lidas do disco por `src/lib/og/imagens.tsx`.
    outputFileTracingIncludes: {
      "/opengraph-image": ["./src/lib/og/fonts/*.ttf"],
      "/cafes/[slug]/og": ["./src/lib/og/fonts/*.ttf"],
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/admin", headers: ADMIN_HEADERS },
      { source: "/admin/:path*", headers: ADMIN_HEADERS },
    ];
  },
  async redirects() {
    return [
      // #50: a URL da Vercel não serve uma cópia do site, mesmo com o SSO desligado.
      ...redirectsParaCanonico(),
      // Slug que mudou (#38): links antigos continuam valendo.
      ...SLUGS_ANTIGOS.map(({ de, para }) => ({ source: `/cafes/${de}`, destination: `/cafes/${para}`, permanent: true })),
    ];
  },
};

export default nextConfig;
