/**
 * As duas RPCs do robô (#183), com a publishable key própria dele. O papel é
 * `anon`, sem grant em tabela: tudo passa pelas funções, que conferem o
 * segredo. Nada de `.from(…)` aqui (guarda no fronteiras.test.ts).
 */
import { createClient } from "@supabase/supabase-js";

import type { Contexto, Rodada, RevisaoParaRegistrar } from "./robo";

export function criarRpc(url: string, chave: string, segredo: string) {
  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  async function resultado<T>(nome: string, chamada: PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<T> {
    const { data, error } = await chamada;
    // Só o código: a mensagem do Postgres pode citar dado.
    if (error) throw new Error(`${nome} falhou (${error.code || "sem código"})`);
    return data as T;
  }

  return {
    lerContexto: () => resultado<Contexto>("curadoria_contexto", supabase.rpc("curadoria_contexto", { p_segredo: segredo })),
    registrar: (rodada: Rodada, revisoes: RevisaoParaRegistrar[]) =>
      resultado<{ rodada_id: string; revisoes_criadas: number }>(
        "curadoria_registrar",
        supabase.rpc("curadoria_registrar", { p_segredo: segredo, p_rodada: rodada, p_revisoes: revisoes }),
      ),
  };
}
