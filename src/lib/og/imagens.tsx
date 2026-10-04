import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { MapPinIcon } from "@/components/icons";
import type { Cafe } from "@/lib/cafe";
import { tonsDoPlaceholder } from "@/lib/cafe-photos";
import { OG_ALTURA, OG_LARGURA } from "@/lib/cafe-seo";
import { localLabel } from "@/lib/format";

/**
 * Imagens de compartilhamento geradas (#49): a do café sem foto e a da home.
 * O `next/og` (satori) não lê Tailwind nem as fontes do `next/font`: estilos
 * inline, cores da paleta viva e os TTF commitados em `./fonts`.
 */

const COR = {
  espresso: "#2C1A0E",
  cream: "#FAF7F2",
  terracotta: "#B5562F",
  onTerracotta: "#FFF8F1",
  ink2: "#5C4636",
  cardLine: "#EFE6DA",
} as const;

const TAMANHO = { width: OG_LARGURA, height: OG_ALTURA };

// Lidas do disco pelo caminho do projeto; o `outputFileTracingIncludes` do
// `next.config.mjs` põe os arquivos na função da Vercel.
const lerFonte = (arquivo: string) => readFile(join(process.cwd(), "src/lib/og/fonts", arquivo));

async function fontes() {
  const [caprasimo, dmSans] = await Promise.all([
    lerFonte("Caprasimo-Regular.ttf"),
    lerFonte("DMSans-Medium.ttf"),
  ]);
  return [
    { name: "Caprasimo", data: caprasimo, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: dmSans, weight: 500 as const, style: "normal" as const },
  ];
}

/**
 * As listras do placeholder (`repeating-linear-gradient(135deg, a 0 14px, b 14px 28px)`).
 * O satori não aceita gradiente repetido: o mesmo desenho sai de um ladrilho de
 * 40 px com duas listras de cada cor (40 / 2√2 ≈ 14 px de largura).
 */
function listras([a, b]: readonly [string, string]) {
  return {
    backgroundColor: a,
    backgroundImage: `linear-gradient(135deg, ${a} 25%, ${b} 25%, ${b} 50%, ${a} 50%, ${a} 75%, ${b} 75%)`,
    backgroundSize: "40px 40px",
  };
}

/** Logo 2d, como o `<Logo />`: "Recife!" na pílula, abaixo do título, nunca inline. */
function Logo({ tamanho }: { tamanho: number }) {
  const pilula = Math.round(tamanho * 0.48);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: "Caprasimo" }}>
      <div style={{ fontSize: tamanho, color: COR.espresso, lineHeight: 1 }}>Mapa do Café</div>
      <div
        style={{
          display: "flex",
          // O satori mede a linha da Caprasimo mais baixa que o navegador: com a
          // margem do `<Logo />` (-0,18 em), a pílula cobriria o acento do "é".
          marginTop: -Math.round(tamanho * 0.04),
          marginRight: -Math.round(tamanho * 0.3),
          padding: `${Math.round(pilula * 0.15)}px ${Math.round(pilula * 0.7)}px ${Math.round(pilula * 0.3)}px`,
          fontSize: pilula,
          lineHeight: 1,
          color: COR.onTerracotta,
          backgroundColor: COR.terracotta,
          borderRadius: 9999,
          transform: "rotate(-5deg)",
          boxShadow: `${Math.round(pilula / 6)}px ${Math.round(pilula / 6)}px 0 ${COR.espresso}`,
        }}
      >
        Recife!
      </div>
    </div>
  );
}

// Nome longo ("Grão Cheff Bistrô & Cafés Especiais") desce de tamanho para caber em duas linhas.
function tamanhoDoNome(nome: string) {
  if (nome.length <= 18) return 92;
  if (nome.length <= 26) return 76;
  return 64;
}

/** Café sem foto: listras do café, cartão cream com nome e local, logo no canto. */
export async function imagemDoCafe(cafe: Pick<Cafe, "id" | "nome" | "bairro" | "cidade">) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 56,
          ...listras(tonsDoPlaceholder(cafe)),
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            gap: 28,
            padding: "52px 60px",
            marginBottom: 36,
            backgroundColor: COR.cream,
            border: `2px solid ${COR.cardLine}`,
            borderRadius: 28,
          }}
        >
          <div
            style={{
              fontFamily: "Caprasimo",
              fontSize: tamanhoDoNome(cafe.nome),
              lineHeight: 1.08,
              color: COR.espresso,
            }}
          >
            {cafe.nome}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: "DM Sans",
              fontSize: 38,
              color: COR.ink2,
            }}
          >
            <MapPinIcon size={38} strokeWidth={2} />
            {localLabel(cafe)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: 24 }}>
          <Logo tamanho={50} />
        </div>
      </div>
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}

/** A frase da imagem da home — também o texto alternativo dela. */
export const CHAMADA_HOME = "Cafés especiais em Recife, Olinda e Jaboatão";

/** Home (e fallback do site): o logo em exibição sobre as listras, e o que é o site. */
export async function imagemDaHome() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          // Sem café, um par fixo de tons do placeholder (o da chave vazia).
          ...listras(tonsDoPlaceholder({ id: "" })),
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 44,
            padding: "64px 88px 56px",
            backgroundColor: COR.cream,
            border: `2px solid ${COR.cardLine}`,
            borderRadius: 32,
          }}
        >
          <Logo tamanho={104} />
          <div style={{ fontFamily: "DM Sans", fontSize: 38, color: COR.ink2 }}>
            {CHAMADA_HOME}
          </div>
        </div>
      </div>
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}
