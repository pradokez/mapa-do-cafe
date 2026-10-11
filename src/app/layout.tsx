import type { Metadata } from "next";
import { Caprasimo, DM_Sans } from "next/font/google";
import { Suspense } from "react";

import { BarraDeProgresso } from "@/components/barra-de-progresso";
import { OPEN_GRAPH_BASE, SITE_DESCRICAO, SITE_NOME } from "@/lib/cafe-seo";
import { siteUrl } from "@/lib/site-url.mjs";

import "./globals.css";

const caprasimo = Caprasimo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-caprasimo",
});
const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  // Base das URLs absolutas: canonical e imagens de compartilhamento saem relativos.
  metadataBase: siteUrl(),
  title: SITE_NOME,
  description: SITE_DESCRICAO,
  // A imagem vem do `opengraph-image.tsx` daqui; o detalhe do café define a sua (#49).
  openGraph: { ...OPEN_GRAPH_BASE, title: SITE_NOME, description: SITE_DESCRICAO },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${caprasimo.variable} ${dmSans.variable}`}>
      <head>
        {/* Sem JS, ninguém ouve o `onLoad`: a foto do Storage aparece sem brilho nem fade (#140). */}
        <noscript>
          <style>{"[data-foto]{opacity:1!important}"}</style>
        </noscript>
      </head>
      <body>
        {/* `useSearchParams` pede Suspense: sem ele, as páginas estáticas sairiam do prerender. */}
        <Suspense fallback={null}>
          <BarraDeProgresso />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
