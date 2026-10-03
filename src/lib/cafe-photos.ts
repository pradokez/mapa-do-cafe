import type { Cafe } from "./cafe";
import { isHttpUrl } from "./url";

export type PhotoSource =
  | { kind: "url"; src: string }
  | { kind: "placeholder"; background: string };

// Pares de tom do placeholder listrado (design › photoBg).
const TONES = [
  ["#E7D8C6", "#DFCDB8"],
  ["#E3D3C0", "#D8C4AD"],
  ["#EADDCD", "#E0CFBC"],
  ["#DFD1C3", "#D3C2B1"],
  ["#E9D6C1", "#DEC7AF"],
] as const;

/**
 * Resolve um café para as imagens a exibir, escondendo de quem chama se elas
 * vêm do Storage ou do placeholder gerado. Fotos reais têm precedência; sem
 * nenhuma, o café ganha um placeholder com tom derivado do `id` — o mesmo
 * café tem sempre a mesma cara.
 */
export function resolveCafePhotos(cafe: Pick<Cafe, "id" | "fotos">): PhotoSource[] {
  const urls = Array.isArray(cafe.fotos) ? cafe.fotos.filter(isHttpUrl) : [];
  if (urls.length > 0) {
    return urls.map((src) => ({ kind: "url", src }));
  }
  const [a, b] = TONES[hash(cafe.id) % TONES.length];
  return [
    {
      kind: "placeholder",
      background: `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`,
    },
  ];
}

// FNV-1a 32 bits: estável entre runtimes, sem dependência.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
