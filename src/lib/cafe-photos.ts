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
  for (let k = 0; photos.length < slots; k++) {
    const [a, b] = tonsDoPlaceholder(cafe, k);
    photos.push({
      kind: "placeholder",
      background: `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`,
    });
  }
  return photos;
}

/**
 * As duas cores das listras do placeholder no slot `slot` (padrão: o 0, o do
 * card). A imagem de compartilhamento usa as mesmas, para o café ter a mesma
 * cara fora do site.
 */
export function tonsDoPlaceholder(cafe: Pick<Cafe, "id">, slot = 0): readonly [string, string] {
  return TONES[(hash(cafe.id) + slot) % TONES.length];
}

/** Bucket público das fotos (#46) — o mesmo da migration `cafe_fotos`. */
export const BUCKET_FOTOS = "cafe-fotos";

// `{cafe_id}/{uuid}.webp`, o formato que o banco aceita em `cafe_fotos`.
const CAMINHO_NO_BUCKET = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i;

/**
 * `cafes.fotos` guarda o caminho no bucket, não a URL: o banco não sabe o
 * endereço do projeto. Quem lê (o `cafe-repository`) passa a URL do Supabase
 * e recebe as URLs públicas, na ordem. O que não é caminho segue como veio —
 * `resolveCafePhotos` descarta o que não for URL.
 */
export function urlsPublicasDasFotos(fotos: unknown, supabaseUrl: string): string[] {
  if (!Array.isArray(fotos)) return [];
  const base = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET_FOTOS}/`;
  return fotos
    .filter((foto): foto is string => typeof foto === "string")
    .map((foto) => (CAMINHO_NO_BUCKET.test(foto) ? base + foto : foto));
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
