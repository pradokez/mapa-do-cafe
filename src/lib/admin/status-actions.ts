"use server";

/**
 * Tirar o café do ar e colocar de volta (#47). Nada é apagado: só `ativo`
 * muda, e o café inativo some do site pela RLS e pelo `cafe-repository`.
 * Quem decide o acesso é a RLS (`private.is_admin()`, política de `update`).
 */
import { revalidatePath } from "next/cache";

import { getCafeById } from "@/lib/cafe-repository";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin } from "./require-admin";
import { revalidarCafe } from "./revalidar";

export type ResultadoStatus = { ok: true } | { ok: false; erro: string };

const ERRO_GERAL = "Não deu para mudar o status agora. Tente de novo em instantes.";
const ERRO_CAFE = "Este café não foi encontrado.";

/**
 * Recebe o estado desejado, não um "alternar": repetir a chamada (clique
 * duplo, duas abas) não desfaz o que a primeira fez.
 */
export async function definirStatus(cafeId: string, ativo: boolean): Promise<ResultadoStatus> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };
  if (typeof ativo !== "boolean") return { ok: false, erro: ERRO_GERAL };

  const cafe = await getCafeById(String(cafeId));
  if (!cafe) return { ok: false, erro: ERRO_CAFE };

  // Update barrado pela RLS não dá erro: só não muda linha nenhuma. Sem a
  // contagem, a tela diria "Pronto" com o café no mesmo estado.
  const { error, count } = await createSessionClient()
    .from("cafes")
    .update({ ativo }, { count: "exact" })
    .eq("id", cafe.id);
  if (error || count !== 1) return { ok: false, erro: ERRO_GERAL };

  revalidarCafe(cafe.slug);
  // O painel inteiro: a lista (etiqueta de status) e esta página.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
