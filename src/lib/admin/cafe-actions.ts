"use server";

/**
 * Edição dos dados de um café (#48). A validação é a mesma do formulário
 * (`cafe-dados`), mas é esta que vale: um payload montado à mão passa por
 * aqui do mesmo jeito. Quem decide o acesso é a RLS (`private.is_admin()`).
 */
import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/admin-auth";
import type { Cafe } from "@/lib/cafe";
import { coordenadasDaUrl, ehLinkDoMaps, validarDadosCafe, type Coordenadas, type ErrosDados } from "@/lib/cafe-dados";
import { getCafeById } from "@/lib/cafe-repository";
import { createSessionClient } from "@/lib/supabase-server";

import { requireAdmin } from "./require-admin";
import { revalidarCafe } from "./revalidar";

export type ResultadoSalvar = { ok: true; cafe: Cafe } | { ok: false; erro: string | null; erros?: ErrosDados };

const ERRO_GERAL = "Não deu para salvar agora. Tente de novo em instantes.";
const ERRO_CAFE = "Este café não foi encontrado.";

/** Grava os dados editáveis (nunca `id`, `slug`, `fotos` nem `ativo`) e devolve o café como ficou. */
export async function salvarDadosCafe(cafeId: string, campos: unknown): Promise<ResultadoSalvar> {
  await requireAdmin();
  if (!isUuid(cafeId)) return { ok: false, erro: ERRO_CAFE };

  const validacao = validarDadosCafe(campos);
  if (!validacao.ok) return { ok: false, erro: null, erros: validacao.erros };

  const cafe = await getCafeById(cafeId);
  if (!cafe) return { ok: false, erro: ERRO_CAFE };

  const { error } = await createSessionClient().from("cafes").update(validacao.valores).eq("id", cafe.id);
  if (error) return { ok: false, erro: ERRO_GERAL };

  // Relido pelo repositório (escrita não usa `.select`): o formulário recebe o que o banco guardou.
  const salvo = await getCafeById(cafe.id);
  if (!salvo) return { ok: false, erro: ERRO_GERAL };

  revalidarCafe(salvo.slug);
  // A lista do painel (nome, bairro, cidade) e o cabeçalho desta página.
  revalidatePath("/admin", "layout");
  return { ok: true, cafe: salvo };
}

export type ResultadoCoordenadas = { ok: true; coordenadas: Coordenadas } | { ok: false; erro: string };

const ERRO_LINK = "Cole um link do Google Maps (o de compartilhar, maps.app.goo.gl/…).";
const ERRO_COORDENADAS = "Não deu para tirar as coordenadas desse link. Preencha lat e lng à mão.";
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;

/**
 * Link do Google Maps → coordenadas. O link curto de compartilhar só revela o
 * lugar no redirect: seguido à mão, conferindo cada salto com `ehLinkDoMaps`
 * — sem isso, esta action buscaria qualquer endereço a partir do servidor.
 */
export async function coordenadasDoLink(link: string): Promise<ResultadoCoordenadas> {
  await requireAdmin();
  let url = String(link ?? "").trim();
  if (!ehLinkDoMaps(url)) return { ok: false, erro: ERRO_LINK };

  try {
    for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
      const coordenadas = coordenadasDaUrl(url);
      if (coordenadas) return { ok: true, coordenadas };
      if (salto === MAX_REDIRECTS) break;

      const resposta = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const destino = resposta.headers.get("location");
      if (resposta.status < 300 || resposta.status >= 400 || !destino) break;

      url = new URL(destino, url).toString();
      if (!ehLinkDoMaps(url)) break;
    }
  } catch {
    // Timeout ou rede: cai na mensagem de preencher à mão.
  }
  return { ok: false, erro: ERRO_COORDENADAS };
}
