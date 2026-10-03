"use server";

/**
 * Login, segundo fator e saída do admin. Tudo no servidor: a chave do Supabase
 * nunca vai para o navegador, e a sessão vive num cookie `httpOnly`.
 *
 * Nenhuma mensagem diz se o email existe, se a senha estava certa para uma
 * conta sem acesso, ou por que o código falhou. Senha, código e segredo do
 * TOTP nunca vão para log.
 */
import { redirect } from "next/navigation";

import { destinoSeguro, etapaDoLogin, urlDoLogin } from "@/lib/admin-auth";
import { createSessionClient } from "@/lib/supabase-server";

export type LoginState = {
  erro: string | null;
  /** Etapa "cadastro-mfa", depois de gerar o QR. */
  cadastro?: { factorId: string; qrCode: string; segredo: string };
};

const ERRO_CREDENCIAL = "Email ou senha incorretos.";
const ERRO_CODIGO = "Código inválido ou expirado. Confira o app e tente de novo.";
const ERRO_GERAL = "Não deu para continuar agora. Tente de novo em instantes.";

function texto(formData: FormData, campo: string, max: number): string | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string" || valor.length === 0 || valor.length > max) return null;
  return valor;
}

function voltarAoLogin(next: FormDataEntryValue | null): never {
  redirect(urlDoLogin(next));
}

/** Etapa 1: email e senha. Conta sem papel de admin sai na hora, com o mesmo erro. */
export async function entrar(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = texto(formData, "email", 320);
  const senha = texto(formData, "senha", 256);
  if (!email || !senha) return { erro: ERRO_CREDENCIAL };

  const supabase = createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error || !data.user) return { erro: ERRO_CREDENCIAL };

  if (etapaDoLogin({ app_metadata: data.user.app_metadata }) === "senha") {
    await supabase.auth.signOut({ scope: "local" });
    return { erro: ERRO_CREDENCIAL };
  }

  // A página do login decide a próxima etapa (código ou cadastro do autenticador).
  voltarAoLogin(formData.get("next"));
}

/**
 * Admin logado só com a senha e o fator TOTP desta etapa — ou `null`, se a
 * sessão não está na etapa esperada (aí, de volta ao login).
 */
async function sessaoNaEtapa(esperada: "codigo" | "cadastro-mfa") {
  const supabase = createSessionClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const etapa = etapaDoLogin(
    { app_metadata: userData.user.app_metadata, aal: aal?.currentLevel },
    { temFatorVerificado: (fatores?.totp.length ?? 0) > 0 },
  );
  if (etapa !== esperada || !fatores) return null;
  return { supabase, fatores };
}

/**
 * Etapa de cadastro: gera o QR do autenticador. Antes, apaga cadastros
 * abandonados (fatores não verificados), para não acumularem.
 */
export async function iniciarCadastroMfa(_: LoginState, formData: FormData): Promise<LoginState> {
  const sessao = await sessaoNaEtapa("cadastro-mfa");
  if (!sessao) voltarAoLogin(formData.get("next"));
  const { supabase, fatores } = sessao;

  for (const fator of fatores.all) {
    if (fator.factor_type === "totp" && fator.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: fator.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Mapa do Café — admin",
    issuer: "Mapa do Café",
  });
  if (error || !data) return { erro: ERRO_GERAL };

  const qr = data.totp.qr_code;
  return {
    erro: null,
    cadastro: {
      factorId: data.id,
      qrCode: qr.startsWith("data:image/svg+xml")
        ? qr
        : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`,
      segredo: data.totp.secret,
    },
  };
}

/**
 * Código de 6 dígitos: confirma o cadastro do autenticador (com o `factorId`
 * recém-gerado) ou completa o login (com o fator já verificado). Sucesso eleva
 * a sessão para `aal2`.
 */
export async function confirmarCodigo(prev: LoginState, formData: FormData): Promise<LoginState> {
  const cadastrando = formData.get("factorId") !== null;
  const sessao = await sessaoNaEtapa(cadastrando ? "cadastro-mfa" : "codigo");
  if (!sessao) voltarAoLogin(formData.get("next"));
  const { supabase, fatores } = sessao;

  const codigo = texto(formData, "codigo", 6);
  // O fator vem do servidor, nunca só do formulário: no cadastro, precisa ser
  // um TOTP não verificado desta conta; no login, o verificado.
  const factorId = cadastrando
    ? fatores.all.find(
        (f) => f.id === formData.get("factorId") && f.factor_type === "totp" && f.status === "unverified",
      )?.id
    : fatores.totp[0]?.id;

  if (!codigo || !/^\d{6}$/.test(codigo) || !factorId) {
    return { ...prev, erro: ERRO_CODIGO };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) return { ...prev, erro: ERRO_CODIGO };

  redirect(destinoSeguro(formData.get("next")));
}

/** Encerra a sessão em todos os dispositivos (revoga os refresh tokens). */
export async function sair(): Promise<never> {
  const supabase = createSessionClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  // Se o servidor de auth não respondeu, ao menos este navegador sai.
  if (error) await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}
