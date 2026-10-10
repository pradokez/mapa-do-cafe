import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { CAFES_TAG, FESTIVAIS_TAG } from "@/lib/cafe-repository";
import { urlDaEdicao, type Edicao } from "@/lib/festival";

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

/**
 * Depois de toda mutation de festival (#102): as leituras do site (tags
 * `festivais` e `cafes` — chip, selo e vitrine vêm da edição), a página da
 * edição e o painel dos festivais. `urls` a mais: o endereço antigo, quando o
 * ano muda.
 */
export function revalidarFestivais(edicao: Pick<Edicao, "festival" | "ano">, ...urls: string[]) {
  revalidateTag(FESTIVAIS_TAG);
  revalidateTag(CAFES_TAG);
  for (const url of [urlDaEdicao(edicao), ...urls]) revalidatePath(url);
  revalidatePath("/admin/festivais", "layout");
}
