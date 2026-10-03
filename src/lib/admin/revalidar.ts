import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { CAFES_TAG } from "@/lib/cafe-repository";

/**
 * Depois de toda mutation do admin: a mudança aparece no site na hora, sem
 * deploy — a home (cache da listagem, por tag) e o detalhe do café.
 */
export function revalidarCafe(slug: string) {
  revalidateTag(CAFES_TAG);
  revalidatePath(`/cafes/${slug}`);
}
