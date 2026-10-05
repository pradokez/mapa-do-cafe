import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { etapaDoLogin, type EtapaDoLogin } from "@/lib/admin-auth";
import { createSessionClient } from "@/lib/supabase-server";

/**
 * Segunda camada do admin (a primeira é o middleware; a garantia real, a RLS).
 * Todo layout, page e Server Action do admin chama isto.
 *
 * `getUser()` vai ao servidor de auth — não confia só no JWT do cookie: sessão
 * encerrada pelo "Sair" global, usuário banido ou apagado não passam, mesmo com
 * um access token que ainda não expirou. Uma vez por request (`cache`).
 */
export const requireAdmin = cache(async (): Promise<{ email: string }> => {
  const sessao = await sessaoDeAdmin();
  if (!sessao) redirect("/admin/login");
  return sessao;
});

/**
 * A mesma decisão do `requireAdmin`, sem redirect: `null` quando a sessão não
 * é de admin com segundo fator. Para a Server Action que precisa explicar a
 * sessão expirada sem apagar o formulário (upload de foto, #74) — quem a usa
 * tem de checar o retorno antes de qualquer efeito.
 */
export const sessaoDeAdmin = cache(async (): Promise<{ email: string } | null> => {
  const supabase = createSessionClient();

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const etapa = etapaDoLogin({
    app_metadata: userData.user.app_metadata,
    aal: aal?.currentLevel,
  });
  if (etapa !== "pronto") return null;

  return { email: userData.user.email ?? "" };
});

/**
 * Em que etapa do login está a sessão do cookie — para a tela de login. Não
 * autoriza nada: quem autoriza é `requireAdmin` (e a RLS).
 */
export async function etapaDaSessao(): Promise<EtapaDoLogin> {
  const supabase = createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const etapa = etapaDoLogin(claims);
  if (etapa === "senha" || etapa === "pronto") return etapa;

  // Admin só com a senha: código ou cadastro, conforme já tenha autenticador.
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  return etapaDoLogin(claims, { temFatorVerificado: (fatores?.totp.length ?? 0) > 0 });
}
