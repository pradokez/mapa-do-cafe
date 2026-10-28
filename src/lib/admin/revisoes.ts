import "server-only";

import type { StatusRevisao, TipoRevisao } from "@/lib/revisao";
import { createSessionClient } from "@/lib/supabase-server";

/**
 * Mudanças de status das revisões (#182), para as actions que já passaram
 * pela checagem de admin — não é Server Action (sem `"use server"`): não se
 * chama de fora. Toda mudança parte de status conhecidos, então uma decisão
 * nunca desfaz outra (duas abas, clique duplo). Quem decide o acesso é a RLS.
 */

/** Muda o status se a revisão estiver em um dos `de`. `false` quando nada mudou (outra decisão, RLS). */
export async function mudarStatusDaRevisao(
  id: string,
  para: StatusRevisao,
  de: readonly StatusRevisao[],
): Promise<boolean> {
  const { error, count } = await createSessionClient()
    .from("revisoes")
    .update({ status: para }, { count: "exact" })
    .eq("id", id)
    .in("status", [...de]);
  return !error && count === 1;
}

/**
 * Marca aprovada a revisão pendente deste tipo e deste café (`null` no café
 * novo). Revisão de outro café, de outro tipo ou já decidida não muda. Para
 * as actions que aplicam a proposta por outro caminho — a fila, o "Editar no
 * café" e o cadastro do café novo.
 */
export async function marcarRevisaoAprovada(id: string, tipo: TipoRevisao, cafeId: string | null): Promise<boolean> {
  const consulta = createSessionClient()
    .from("revisoes")
    .update({ status: "aprovada" }, { count: "exact" })
    .eq("id", id)
    .eq("status", "pendente")
    .eq("tipo", tipo);
  const { error, count } = await (cafeId === null ? consulta.is("cafe_id", null) : consulta.eq("cafe_id", cafeId));
  return !error && count === 1;
}
