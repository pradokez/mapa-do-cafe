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
 * vêm do Storage ou do placeholder gerado. Fotos reais vêm primeiro, na
 * ordem; placeholders completam até `minSlots` (padrão 1), para quem exibe
 * vários slots nunca ter um vazio. O tom do placeholder deriva do `id` e
 * avança um por slot — o mesmo café tem sempre a mesma cara, e o slot 0 é
 * o mesmo no card e no carrossel.
 */
export function resolveCafePhotos(
  cafe: Pick<Cafe, "id" | "fotos">,
  { minSlots = 1 }: { minSlots?: number } = {},
): PhotoSource[] {
  const urls = Array.isArray(cafe.fotos) ? cafe.fotos.filter(isHttpUrl) : [];
  const photos: PhotoSource[] = urls.map((src) => ({ kind: "url", src }));
  const slots = Number.isFinite(minSlots) ? Math.max(1, Math.floor(minSlots)) : 1;
  const tone = hash(cafe.id);
  for (let k = 0; photos.length < slots; k++) {
    const [a, b] = TONES[(tone + k) % TONES.length];
    photos.push({
      kind: "placeholder",
      background: `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`,
    });
  }
  return photos;
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
