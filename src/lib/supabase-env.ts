/**
 * Configuração comum aos clients do Supabase. Sem `server-only` porque o
 * middleware (que não roda como Server Component) também usa — mas nada aqui
 * leva `NEXT_PUBLIC_`: as variáveis só existem no servidor.
 */
import type { CookieOptionsWithName } from "@supabase/ssr";

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }
  return { url, key };
}

const producao = process.env.NODE_ENV === "production";

/**
 * Cookie da sessão do admin. Não existe client do Supabase no navegador, então
 * nenhum JS precisa lê-lo: `httpOnly`. Em produção, prefixo `__Host-` (o
 * navegador só aceita com `secure`, `path=/` e sem `domain` — nem um subdomínio
 * consegue sobrescrevê-lo). Vale 12 h no dispositivo: depois, senha e código de
 * novo.
 */
export const SESSION_COOKIE: CookieOptionsWithName = {
  name: producao ? "__Host-mapa-admin" : "mapa-admin",
  path: "/",
  httpOnly: true,
  secure: producao,
  sameSite: "lax",
  maxAge: 12 * 60 * 60,
};
