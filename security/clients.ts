import { createHmac } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PUBLISHABLE_KEY, SECRET_KEY, SUPABASE_URL } from "./env";

/** Client anônimo: só a publishable key, como um visitante qualquer. Sujeito à RLS. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client com a secret key: ignora a RLS. Só para montar e conferir o cenário. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UsuarioTeste = { email: string; password: string; id: string };

const SENHA = "Teste-Pentest-9!xZ";

/**
 * Cria um usuário já confirmado via admin API (service key), com os metadados
 * pedidos. `appMetadata.role` é o que a RLS confere; `userMetadata.role` é o que
 * o próprio usuário conseguiria editar — e que não pode valer de admin.
 */
export async function criarUsuario(
  rotulo: string,
  { appMetadata, userMetadata }: { appMetadata?: object; userMetadata?: object } = {},
): Promise<UsuarioTeste> {
  const email = `pentest+${rotulo}-${Date.now()}@mapadocafe-pe.com.br`;
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (error || !data.user) throw new Error(`não criou o usuário ${rotulo}: ${error?.message}`);
  return { email, password: SENHA, id: data.user.id };
}

/** Apaga um usuário de teste (limpeza no fim do arquivo). */
export async function apagarUsuario(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}

/**
 * Loga como o usuário e devolve um client **autenticado** (aal1 — só a senha).
 * É o que um usuário comum, ou um com `user_metadata.role=admin`, teria.
 */
export async function clientAutenticado(usuario: UsuarioTeste): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: usuario.email, password: usuario.password });
  if (error) throw new Error(`não logou ${usuario.email}: ${error.message}`);
  return client;
}

// --- TOTP (RFC 6238) para tentar uma sessão aal2 real quando o plano permite ---

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(segredo: string): Buffer {
  const limpo = segredo.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const c of limpo) {
    const i = BASE32.indexOf(c);
    if (i < 0) continue;
    bits += i.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Código TOTP de 6 dígitos para o instante dado — para enroll/verify do autenticador. */
export function totp(segredo: string, emMs = Date.now()): string {
  const contador = Math.floor(emMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac("sha1", base32Decode(segredo)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}
