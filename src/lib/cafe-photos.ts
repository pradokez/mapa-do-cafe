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
 * vêm do Storage ou do placeholder gerado. As fotos reais, na ordem; sem
 * nenhuma, um placeholder só — nunca slot sem foto completando a lista. O
 * tom do placeholder deriva do `id`: o mesmo café tem sempre a mesma cara,
 * no card e no carrossel. Com `tom: "escuro"`, o placeholder sai nos tons
 * escuros, também escolhidos pelo `id`.
 */
export function resolveCafePhotos(
  cafe: Pick<Cafe, "id" | "fotos">,
  { tom = "claro" }: { tom?: TomDoPlaceholder } = {},
): PhotoSource[] {
  const urls = Array.isArray(cafe.fotos) ? cafe.fotos.filter(isHttpUrl) : [];
  if (urls.length === 0) return [{ kind: "placeholder", background: listras(cafe, tom) }];
  return urls.map((src) => ({ kind: "url", src }));
}

/**
 * As duas cores das listras do placeholder. A imagem de compartilhamento usa
 * as mesmas, para o café ter a mesma cara fora do site.
 */
export function tonsDoPlaceholder(cafe: Pick<Cafe, "id">): readonly [string, string] {
  return TONES[hash(cafe.id) % TONES.length];
}

function listras(cafe: Pick<Cafe, "id">, tom: TomDoPlaceholder): string {
  if (tom === "escuro") {
    const escuro = TONS_ESCUROS[hash(cafe.id) % TONS_ESCUROS.length];
    return `repeating-linear-gradient(135deg, ${escuro} 0 12px, ${ESPRESSO} 12px 24px)`;
  }
  const [a, b] = tonsDoPlaceholder(cafe);
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
