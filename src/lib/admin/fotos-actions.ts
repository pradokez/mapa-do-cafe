"use server";

/**
 * Upload de foto com registro de autorização (#46), em três passos:
 *
 * 1. `prepararUpload` confere a autorização e devolve uma URL assinada para um
 *    caminho gerado aqui (`{cafe_id}/{uuid}.webp`);
 * 2. o navegador sobe o WebP direto para o Storage — o arquivo não passa pela
 *    Server Action nem pela Vercel;
 * 3. `registrarFoto` grava a linha em `cafe_fotos` (o trigger atualiza
 *    `cafes.fotos`) e invalida o cache. Se o registro falha, o arquivo é
 *    apagado: não existe foto no bucket sem autorização registrada.
 *
 * Se o passo 3 nem chega ao servidor, o formulário chama `descartarUpload`.
 * Depois de no ar, a foto muda de posição (`reordenarFoto`) ou sai
 * (`removerFoto`) — #51. Quem decide o acesso, em cada passo, é a RLS (`private.is_admin()`).
 */
import { revalidatePath } from "next/cache";

import { BUCKET_FOTOS } from "@/lib/cafe-photos";
import { fotoRegistrada, getCafeById, listFotosDoCafe } from "@/lib/cafe-repository";
import { moverFoto, ordensParaGravar, type Movimento } from "@/lib/foto-ordem";
import {
  caminhoDaFoto,
  checarWebp,
  ehCaminhoDoCafe,
  hojeEmRecife,
  validarAutorizacao,
  type CampoAutorizacao,
} from "@/lib/foto-upload";
import { createSessionClient } from "@/lib/supabase-server";

import { requireAdmin } from "./require-admin";
import { revalidarCafe } from "./revalidar";

export type CamposAutorizacao = Partial<Record<CampoAutorizacao, unknown>>;

export type ResultadoFoto =
  | { ok: true }
  | { ok: false; erro: string | null; erros?: Partial<Record<CampoAutorizacao, string>> };

export type ResultadoPreparo = { ok: true; caminho: string; url: string } | Extract<ResultadoFoto, { ok: false }>;

const ERRO_GERAL = "Não deu para enviar a foto agora. Tente de novo em instantes.";
const ERRO_CAFE = "Este café não foi encontrado.";

function autorizacao(campos: CamposAutorizacao) {
  return validarAutorizacao(campos ?? {}, hojeEmRecife(new Date()));
}

/** Passo 1: autorização e arquivo conferidos antes de qualquer byte subir. */
export async function prepararUpload(
  cafeId: string,
  campos: CamposAutorizacao,
  arquivo: { type: string; size: number },
): Promise<ResultadoPreparo> {
  await requireAdmin();

  const validacao = autorizacao(campos);
  if (!validacao.ok) return { ok: false, erro: null, erros: validacao.erros };

  const erroArquivo = checarWebp({ type: String(arquivo?.type), size: Number(arquivo?.size) });
  if (erroArquivo) return { ok: false, erro: erroArquivo };

  const cafe = await getCafeById(String(cafeId));
  if (!cafe) return { ok: false, erro: ERRO_CAFE };

  const caminho = caminhoDaFoto(cafe.id, crypto.randomUUID());
  const { data, error } = await createSessionClient().storage.from(BUCKET_FOTOS).createSignedUploadUrl(caminho);
  if (error || !data) return { ok: false, erro: ERRO_GERAL };

  return { ok: true, caminho, url: data.signedUrl };
}

/** Passo 3: registra a foto já no bucket. Qualquer falha apaga o arquivo. */
export async function registrarFoto(
  cafeId: string,
  caminho: string,
  campos: CamposAutorizacao,
): Promise<ResultadoFoto> {
  await requireAdmin();
  if (!ehCaminhoDoCafe(cafeId, caminho)) return { ok: false, erro: ERRO_GERAL };

  const supabase = createSessionClient();
  const fotos = supabase.storage.from(BUCKET_FOTOS);
  const falhar = async (resultado: Extract<ResultadoFoto, { ok: false }>) => {
    await fotos.remove([caminho]);
    return resultado;
  };

  const validacao = autorizacao(campos);
  if (!validacao.ok) return falhar({ ok: false, erro: null, erros: validacao.erros });

  const cafe = await getCafeById(cafeId);
  if (!cafe) return falhar({ ok: false, erro: ERRO_CAFE });

  // O upload pode ter falhado sem o navegador perceber: sem arquivo, sem linha.
  const { data: existe } = await fotos.exists(caminho);
  if (!existe) return { ok: false, erro: ERRO_GERAL };

  const { error } = await supabase
    .from("cafe_fotos")
    .insert({ cafe_id: cafe.id, storage_path: caminho, ...validacao.valores });
  if (error) return falhar({ ok: false, erro: ERRO_GERAL });

  revalidarFotos(cafe.slug);
  return { ok: true };
}

/** O site (capa, carrossel) e o painel inteiro: a lista (nº de fotos) e esta página. */
function revalidarFotos(slug: string) {
  revalidarCafe(slug);
  revalidatePath("/admin", "layout");
}

/**
 * O registro não respondeu (rede caiu): apaga o arquivo, a menos que a linha
 * tenha sido gravada mesmo assim — aí a foto está no ar e fica.
 */
export async function descartarUpload(cafeId: string, caminho: string): Promise<void> {
  await requireAdmin();
  if (!ehCaminhoDoCafe(cafeId, caminho)) return;
  if (await fotoRegistrada(caminho)) return;

  await createSessionClient().storage.from(BUCKET_FOTOS).remove([caminho]);
}

export type ResultadoAcaoFoto = { ok: true } | { ok: false; erro: string };

const ERRO_FOTO = "Esta foto não foi encontrada. Recarregue a página.";
const ERRO_ORDEM = "Não deu para mudar a ordem agora. Tente de novo em instantes.";
const ERRO_REMOCAO = "Não deu para remover a foto agora. Tente de novo em instantes.";

/** Café e foto conferidos no servidor: o id vindo do cliente precisa ser de uma foto deste café. */
async function fotoDoCafe(cafeId: string, fotoId: string) {
  const cafe = await getCafeById(String(cafeId));
  if (!cafe) return null;
  const fotos = await listFotosDoCafe(cafe.id);
  const foto = fotos.find((f) => f.id === fotoId);
  return foto ? { cafe, fotos, foto } : null;
}

/**
 * Sobe, desce ou leva a foto para a capa. Grava `ordem` = posição só onde
 * muda; uma gravação que falhe no meio deixa um estado válido (sem `unique`,
 * empate cai no `criado_em`) que a próxima tentativa corrige.
 */
export async function reordenarFoto(cafeId: string, fotoId: string, movimento: Movimento): Promise<ResultadoAcaoFoto> {
  await requireAdmin();

  const achado = await fotoDoCafe(cafeId, fotoId);
  if (!achado) return { ok: false, erro: ERRO_FOTO };
  const { cafe, fotos } = achado;

  const nova = moverFoto(
    fotos.map((f) => f.id),
    fotoId,
    movimento,
  );
  if (!nova) return { ok: false, erro: ERRO_ORDEM };

  const supabase = createSessionClient();
  for (const { id, ordem } of ordensParaGravar(fotos, nova)) {
    // A RLS não dá erro, só não grava: sem a linha afetada, não houve mudança.
    const { error, count } = await supabase
      .from("cafe_fotos")
      .update({ ordem }, { count: "exact" })
      .eq("id", id)
      .eq("cafe_id", cafe.id);
    if (error || count !== 1) {
      revalidarFotos(cafe.slug);
      return { ok: false, erro: ERRO_ORDEM };
    }
  }

  revalidarFotos(cafe.slug);
  return { ok: true };
}

/**
 * Apaga a linha e depois o arquivo — nessa ordem: se o Storage falhar, sobra
 * um arquivo órfão (inofensivo, fora do site), nunca uma linha apontando para
 * um arquivo que não existe. Sem a última foto, o trigger esvazia
 * `cafes.fotos` e o café volta ao placeholder.
 */
export async function removerFoto(cafeId: string, fotoId: string): Promise<ResultadoAcaoFoto> {
  await requireAdmin();

  const achado = await fotoDoCafe(cafeId, fotoId);
  if (!achado) return { ok: false, erro: ERRO_FOTO };
  const { cafe, foto } = achado;

  const supabase = createSessionClient();
  const { error, count } = await supabase
    .from("cafe_fotos")
    .delete({ count: "exact" })
    .eq("id", foto.id)
    .eq("cafe_id", cafe.id);
  // A RLS não dá erro, só não apaga: o arquivo só sai se a linha saiu de fato.
  if (error || count !== 1) return { ok: false, erro: ERRO_REMOCAO };

  await supabase.storage.from(BUCKET_FOTOS).remove([foto.storage_path]);
  revalidarFotos(cafe.slug);
  return { ok: true };
}
