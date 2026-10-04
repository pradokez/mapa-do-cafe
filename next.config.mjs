import { redirectsParaCanonico } from "./src/lib/site-url.mjs";

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
      // #38: o Borsoi do RioMar ganhou slug próprio; links antigos continuam valendo.
      { source: "/cafes/borsoi-cafe", destination: "/cafes/borsoi-cafe-riomar", permanent: true },
    ];
  },
};

export default nextConfig;
