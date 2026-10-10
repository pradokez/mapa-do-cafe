import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { CAFES_TAG, FESTIVAIS_TAG } from "@/lib/cafe-repository";

/**
 * Depois de toda mutation do admin: a mudança aparece no site na hora, sem
 * deploy — a home (cache da listagem, por tag) e o detalhe do café. Os
 * festivais também: só café no ar conta como participante (#100).
 */
export function revalidarCafe(slug: string) {
  revalidateTag(CAFES_TAG);
  revalidateTag(FESTIVAIS_TAG);
  revalidatePath(`/cafes/${slug}`);
}
