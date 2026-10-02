import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa do Café",
  description: "Diretório de cafés especiais em Recife e Olinda.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
