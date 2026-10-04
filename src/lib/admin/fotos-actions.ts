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
 * Quem decide o acesso, em cada passo, é a RLS (`private.is_admin()`).
 */
import { revalidatePath } from "next/cache";

import { BUCKET_FOTOS } from "@/lib/cafe-photos";
import { fotoRegistrada, getCafeById } from "@/lib/cafe-repository";
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

  revalidarCafe(cafe.slug);
  // O painel inteiro: a lista (nº de fotos) e esta página (miniaturas).
  revalidatePath("/admin", "layout");
  return { ok: true };
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
