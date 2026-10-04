/**
 * Client do Supabase com a sessão do admin (cookie). Só servidor: Server
 * Components e Server Actions. Quem lê tabela com ele é o `cafe-repository`;
 * quem cuida da sessão é `src/lib/admin/`.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SESSION_COOKIE, supabaseEnv } from "./supabase-env";

export function createSessionClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não grava cookie; quem renova a sessão é o middleware.
        }
      },
    },
  });
}
