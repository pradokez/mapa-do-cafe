import type { Metadata } from "next";
import { Caprasimo, DM_Sans } from "next/font/google";
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
  title: "Mapa do Café",
  description: "Diretório de cafés especiais em Recife e Olinda.",
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
