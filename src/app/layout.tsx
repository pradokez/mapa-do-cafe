import type { Metadata } from "next";
import { Caprasimo, DM_Sans } from "next/font/google";
import { SITE_DESCRICAO, SITE_NOME } from "@/lib/cafe-seo";
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
  // Base das URLs absolutas: canonical (e Open Graph, #49) saem relativos.
  metadataBase: siteUrl(),
  title: SITE_NOME,
  description: SITE_DESCRICAO,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${caprasimo.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
