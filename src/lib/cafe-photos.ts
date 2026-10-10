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

// Tons do placeholder sobre `espresso` (design 4b, a vitrine da home): o par
// claro sumiria no card escuro. Cada tom listra com o próprio espresso.
const TONS_ESCUROS = ["#3E2A1C", "#4A3424", "#3A2618", "#45301F"] as const;
const ESPRESSO = "#2C1A0E";

/** `claro` (padrão) sobre o cream do site; `escuro` sobre `espresso`. */
export type TomDoPlaceholder = "claro" | "escuro";

/**
 * Resolve um café para as imagens a exibir, escondendo de quem chama se elas
 * vêm do Storage ou do placeholder gerado. Fotos reais vêm primeiro, na
 * ordem; placeholders completam até `minSlots` (padrão 1), para quem exibe
 * vários slots nunca ter um vazio. O tom do placeholder deriva do `id` e
 * avança um por slot — o mesmo café tem sempre a mesma cara, e o slot 0 é
 * o mesmo no card e no carrossel. Com `tom: "escuro"`, o placeholder sai
 * nos tons escuros, também escolhidos pelo `id`.
 */
export function resolveCafePhotos(
  cafe: Pick<Cafe, "id" | "fotos">,
  { minSlots = 1, tom = "claro" }: { minSlots?: number; tom?: TomDoPlaceholder } = {},
): PhotoSource[] {
  const urls = Array.isArray(cafe.fotos) ? cafe.fotos.filter(isHttpUrl) : [];
  const photos: PhotoSource[] = urls.map((src) => ({ kind: "url", src }));
  const slots = Number.isFinite(minSlots) ? Math.max(1, Math.floor(minSlots)) : 1;
  for (let k = 0; photos.length < slots; k++) {
    photos.push({ kind: "placeholder", background: listras(cafe, k, tom) });
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

function listras(cafe: Pick<Cafe, "id">, slot: number, tom: TomDoPlaceholder): string {
  if (tom === "escuro") {
    const escuro = TONS_ESCUROS[(hash(cafe.id) + slot) % TONS_ESCUROS.length];
    return `repeating-linear-gradient(135deg, ${escuro} 0 12px, ${ESPRESSO} 12px 24px)`;
  }
  const [a, b] = tonsDoPlaceholder(cafe, slot);
  return `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`;
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
  return fotos
    .filter((foto): foto is string => typeof foto === "string")
    .map((foto) => (CAMINHO_NO_BUCKET.test(foto) ? urlPublicaNoBucket(supabaseUrl, BUCKET_FOTOS, foto) : foto));
}

/** URL pública de um objeto num bucket público — as fotos e as artes dos festivais. */
export function urlPublicaNoBucket(supabaseUrl: string, bucket: string, caminho: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${caminho}`;
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
