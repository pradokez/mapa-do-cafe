"use server";

/**
 * Decisão sobre as revisões da curadoria (#182, PRD #167). Aprovar grava em
 * `cafes` pelo mesmo caminho da edição: a proposta passa pelo `cafe-dados` e
 * só o que ele devolve vai ao banco. Nada do robô chega ao site sem isso.
 */
import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/admin-auth";
import { validarDadosCafe } from "@/lib/cafe-dados";
import { getCafeById, getRevisaoById } from "@/lib/cafe-repository";
import { acoesDaRevisao, mesmoValor, type DecisaoDeRevisao } from "@/lib/revisao";
import { createSessionClient } from "@/lib/supabase-server";

import { bloqueioDeEscrita } from "./escrita";
import { requireAdmin } from "./require-admin";
import { revalidarCafe } from "./revalidar";
import { marcarRevisaoAprovada, mudarStatusDaRevisao } from "./revisoes";

const ERRO_GERAL = "Não deu para decidir esta revisão agora. Tente de novo em instantes.";
const ERRO_DECIDIDA = "Esta revisão já foi decidida.";
const ERRO_CONFIRMACAO = "Confirme que quer aprovar mesmo com a fonte antiga, sem data ou discordante.";
const ERRO_INVALIDA = "O valor proposto não passa na validação do café. Corrija à mão na página do café ou rejeite.";

/**
 * Aprova uma revisão de atualização ou fechamento, relida do banco (o form só
 * traz o id e a confirmação). Formato do `useFormState`: os botões funcionam
 * também sem JavaScript. Fora de `atualizada`, só com `confirmacao=1`.
 */
export async function aprovarRevisao(_anterior: DecisaoDeRevisao, dados: FormData): Promise<DecisaoDeRevisao> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const id = dados.get("id");
  if (typeof id !== "string" || !isUuid(id)) return { ok: false, erro: ERRO_GERAL };

  const revisao = await getRevisaoById(id);
  if (!revisao) return { ok: false, id, erro: ERRO_GERAL };
  if (revisao.status !== "pendente") return { ok: false, id, erro: ERRO_DECIDIDA };
  // Café novo (pelo cadastro) e indício sem campo não têm o que aprovar aqui.
  if (!acoesDaRevisao(revisao).aprovar || !revisao.cafe_id) return { ok: false, id, erro: ERRO_GERAL };
  // A atualidade é a da linha no banco, nunca a do form.
  if (revisao.atualidade !== "atualizada" && dados.get("confirmacao") !== "1") {
    return { ok: false, id, erro: ERRO_CONFIRMACAO };
  }

  const cafe = await getCafeById(revisao.cafe_id);
  if (!cafe) return { ok: false, id, erro: ERRO_GERAL };

  const { campo } = revisao;
  // O banco mudou depois da coleta (uma edição à mão, outra revisão, o café já
  // fora do ar): aprovar sobrescreveria o que a administradora fez.
  const mudou = campo === null ? !cafe.ativo : !mesmoValor(cafe[campo], revisao.valor_atual);
  if (mudou) {
    if (!(await mudarStatusDaRevisao(revisao.id, "obsoleta", ["pendente"]))) return { ok: false, id, erro: ERRO_GERAL };
    revalidatePath("/admin", "layout");
    return { ok: true, id, status: "obsoleta" };
  }

  // Fechamento: como a seção Status (`definirStatus`), só `ativo` muda. Atualização:
  // o café inteiro com o campo trocado passa pelo `cafe-dados`, e só o campo
  // (normalizado) vai ao banco — o resto do café fica como está.
  let gravar: Record<string, unknown> = { ativo: false };
  if (campo !== null) {
    const validacao = validarDadosCafe({
      ...cafe,
      [campo]: revisao.valor_proposto,
    });
    if (!validacao.ok) return { ok: false, id, erro: ERRO_INVALIDA };
    gravar = { [campo]: validacao.valores[campo] };
  }

  // Update barrado pela RLS não dá erro: só não muda linha nenhuma.
  const { error, count } = await createSessionClient()
    .from("cafes")
    .update(gravar, { count: "exact" })
    .eq("id", cafe.id);
  if (error || count !== 1) return { ok: false, id, erro: ERRO_GERAL };
  revalidarCafe(cafe.slug);
  revalidatePath("/admin", "layout");

  // Sem transação: se só a marcação falhar, a próxima tentativa vê o banco mudado e marca obsoleta.
  if (!(await marcarRevisaoAprovada(revisao.id, revisao.tipo, revisao.cafe_id)))
    return { ok: false, id, erro: ERRO_GERAL };
  return { ok: true, id, status: "aprovada" };
}

/**
 * Rejeitar (e "Arquivar", no indício): recebe o estado desejado, então repetir
 * o envio não falha nem desfaz nada. Aprovada ou obsoleta não volta. A
 * rejeitada segura a mesma proposta por 90 dias (o robô lê os pares).
 */
export async function rejeitarRevisao(_anterior: DecisaoDeRevisao, dados: FormData): Promise<DecisaoDeRevisao> {
  await requireAdmin();
  const bloqueio = bloqueioDeEscrita();
  if (bloqueio) return { ok: false, erro: bloqueio };

  const id = dados.get("id");
  if (typeof id !== "string" || !isUuid(id)) return { ok: false, erro: ERRO_GERAL };

  if (!(await mudarStatusDaRevisao(id, "rejeitada", ["pendente", "rejeitada"]))) {
    return { ok: false, id, erro: ERRO_GERAL };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, id, status: "rejeitada" };
}
