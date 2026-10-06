"use server";

/**
 * Triagem das sugestões do público (#84): só o `status` muda. A mensagem fica
 * como chegou — o banco garante (grant de `update` só na coluna `status`), e
 * a action nem monta outro campo. Nada é apagado: não há `delete`.
 */
import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/admin-auth";
import { ehStatusSugestao, type MudancaDeStatus } from "@/lib/sugestao";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin } from "./require-admin";

const ERRO_GERAL = "Não deu para mudar o status agora. Tente de novo em instantes.";

/**
 * Recebe o status desejado, não um "avançar": repetir o envio (clique duplo,
 * duas abas) não desfaz o que o primeiro fez. Formato do `useFormState`, para
 * os botões funcionarem também sem JavaScript.
 */
export async function mudarStatusSugestao(_anterior: MudancaDeStatus, dados: FormData): Promise<MudancaDeStatus> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const id = dados.get("id");
  const status = dados.get("status");
  if (typeof id !== "string" || !isUuid(id) || !ehStatusSugestao(status)) return { ok: false, erro: ERRO_GERAL };

  const { error, count } = await createSessionClient()
    .from("sugestoes")
    .update({ status }, { count: "exact" })
    .eq("id", id);
  // Update barrado pela RLS não dá erro: só não muda linha nenhuma.
  if (error || count !== 1) return { ok: false, erro: ERRO_GERAL };

  // O painel inteiro: a lista, os contadores dos chips e o cartão do `/admin`.
  revalidatePath("/admin", "layout");
  return { ok: true, id, status };
}
