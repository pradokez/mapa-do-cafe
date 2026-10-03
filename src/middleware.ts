import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { destinoSeguro, etapaDoLogin } from "@/lib/admin-auth";
import { SESSION_COOKIE, supabaseEnv } from "@/lib/supabase-env";

/**
 * Primeira camada do admin: só experiência. Sem sessão de admin com segundo
 * fator, qualquer `/admin/*` vai para o login. A garantia real é a RLS; no
 * servidor, cada página ainda chama `requireAdmin()`.
 *
 * Também renova a sessão (padrão do `@supabase/ssr`): Server Component não
 * grava cookie, então o token renovado sai daqui.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [nome, valor] of Object.entries(headers ?? {})) response.headers.set(nome, valor);
      },
    },
  });

  // Verifica a assinatura do JWT (pelo JWKS do projeto) sem ir ao servidor de auth.
  const { data } = await supabase.auth.getClaims();
  const pronto = etapaDoLogin(data?.claims ?? null) === "pronto";

  const { pathname, search } = request.nextUrl;
  const naTelaDeLogin = pathname === "/admin/login";

  if (pronto && naTelaDeLogin) {
    return redirecionar(request, response, destinoSeguro(request.nextUrl.searchParams.get("next")));
  }
  if (!pronto && !naTelaDeLogin) {
    const destino = destinoSeguro(pathname + search);
    const login = destino === "/admin" ? "/admin/login" : `/admin/login?next=${encodeURIComponent(destino)}`;
    return redirecionar(request, response, login);
  }
  return response;
}

/** Redireciona levando os cookies que a renovação da sessão acabou de gravar. */
function redirecionar(request: NextRequest, response: NextResponse, caminho: string) {
  const redirect = NextResponse.redirect(new URL(caminho, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
