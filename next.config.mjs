import { redirectsParaCanonico } from "./src/lib/site-url.mjs";
import { SLUGS_ANTIGOS } from "./src/lib/slugs-antigos.mjs";

/**
 * Headers do admin (#43): fora de busca, fora de cache e fora de iframe
 * (clickjacking). Valem também para o redirect do middleware.
 */
const ADMIN_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
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
