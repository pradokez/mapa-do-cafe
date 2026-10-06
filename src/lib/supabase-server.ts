/**
 * Clients do Supabase. Só servidor: Server Components e Server Actions.
 *
 * - `createSessionClient`: com a sessão do admin (cookie). Quem lê tabela com
 *   ele é o `cafe-repository`; quem cuida da sessão é `src/lib/admin/`.
 * - `createAnonClient`: sem sessão, sempre `anon` — a leitura pública do
 *   `cafe-repository` e o envio de sugestão (#83).
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

/** Sem cookie nem sessão: o que a RLS e os grants deixam ao `anon`. */
export function createAnonClient() {
  const { url, key } = supabaseEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}
