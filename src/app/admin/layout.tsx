import type { Metadata } from "next";

// Fora de busca também pelo <meta>; os headers (`X-Robots-Tag`, `no-store`,
// anti-iframe) vêm do next.config.
export const metadata: Metadata = {
  title: { default: "Admin · Mapa do Café", template: "%s · Admin · Mapa do Café" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
