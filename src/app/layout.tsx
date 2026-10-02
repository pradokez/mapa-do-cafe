import type { Metadata } from "next";
import { Caprasimo, DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const caprasimo = Caprasimo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-caprasimo",
});
const playfair = Playfair_Display({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-playfair",
});
const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Mapa do Café",
  description: "Diretório de cafés especiais em Recife e Olinda.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${caprasimo.variable} ${playfair.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
