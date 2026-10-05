"use server";

/**
 * Envio público de sugestão (#83) — a única Server Action sem admin. Não lê
 * nem escreve tabela: chama só a função `enviar_sugestao`, como `anon` (sem
 * cookie), e a função confere o limite de envios por IP.
 *
 * O IP não sai daqui: vai como HMAC com `SUGESTOES_IP_SECRET`. Sem o segredo
 * (ou sem IP), falha fechada — gravar sem o limite valer abriria o banco para
 * robôs.
 */
import { headers } from "next/headers";

import { createAnonClient } from "@/lib/supabase-server";

import { ENVIO_INICIAL, hashDoIp, validarSugestao, type EnvioSugestao } from "./sugestao";

/** SQLSTATE da `enviar_sugestao` para o 6º envio do mesmo IP na hora. */
const LIMITE_ATINGIDO = "MC429";

/** IP de quem enviou. Na Vercel, o `x-forwarded-for` é preenchido por ela (o 1º é o cliente). */
function ipDoCliente(): string | null {
  const cabecalhos = headers();
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0].trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || null;
}

export async function enviarSugestao(_anterior: EnvioSugestao, formData: FormData): Promise<EnvioSugestao> {
  const valores = { tipo: String(formData.get("tipo") ?? ""), mensagem: String(formData.get("mensagem") ?? "") };
  const r = validarSugestao({ ...valores, origem: formData.get("origem"), site: formData.get("site") });
  // Robô: finge que deu certo, para ele não aprender a contornar.
  if (!r.ok && r.robo) return { ...ENVIO_INICIAL, status: "enviado" };
  if (!r.ok) return { status: "erro", erros: r.erros, valores };

  const falha: EnvioSugestao = { status: "falha", erros: {}, valores };
  const segredo = process.env.SUGESTOES_IP_SECRET;
  const ip = ipDoCliente();
  if (!segredo || !ip) {
    console.error("[sugestoes] envio recusado", { motivo: segredo ? "sem IP" : "sem SUGESTOES_IP_SECRET" });
    return falha;
  }

  const { tipo, mensagem, origem } = r.dados;
  let codigo: string;
  try {
    const { error } = await createAnonClient().rpc("enviar_sugestao", {
      p_tipo: tipo,
      p_mensagem: mensagem,
      p_origem: origem,
      p_ip_hash: await hashDoIp(ip, segredo),
    });
    if (!error) return { status: "enviado", erros: {}, valores };
    codigo = error.code;
  } catch (e) {
    codigo = e instanceof Error ? e.name : "desconhecido";
  }

  if (codigo === LIMITE_ATINGIDO) return { status: "limite", erros: {}, valores };
  // Só o código: a mensagem do Postgres pode citar o texto enviado.
  console.error("[sugestoes] envio falhou", { codigo });
  return falha;
}
