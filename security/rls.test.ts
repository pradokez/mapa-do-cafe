import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  apagarUsuario,
  clientAutenticado,
  criarUsuario,
  serviceClient,
  type UsuarioTeste,
} from "./clients";
import { motivoSemEscrita, motivoSemLeitura, PODE_ESCREVER, PODE_LER } from "./env";

/**
 * RLS de `cafes` e `cafe_fotos` (#59). A garantia real do admin é a RLS; aqui
 * um atacante com só a publishable key — e um usuário autenticado sem papel —
 * tenta ler o que não devia e gravar onde não devia. Tudo precisa ser negado
 * ou voltar vazio. Ver docs/security/pentest-2026-10.md.
 */

const leitura = PODE_LER ? describe : describe.skip;
const escrita = PODE_ESCREVER ? describe : describe.skip;

if (!PODE_LER) console.warn(`[security] RLS de leitura pulada: ${motivoSemLeitura}`);
if (!PODE_ESCREVER) console.warn(`[security] RLS de escrita pulada: ${motivoSemEscrita}`);

/** Pega o slug de um café inativo real pela secret key (para tentar lê-lo como anônimo). */
async function slugInativo(): Promise<string> {
  const { data } = await serviceClient().from("cafes").select("slug").eq("ativo", false).limit(1);
  return data?.[0]?.slug ?? "castigliani";
}

leitura("anônimo (publishable key) e a RLS de cafes", () => {
  const anon = anonClient();

  it("lê os cafés ativos (é o caminho público normal)", async () => {
    const { data, error } = await anon.from("cafes").select("slug,ativo").eq("ativo", true).limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((c) => c.ativo === true)).toBe(true);
  });

  it("não lê café inativo, nem por slug, nem forçando o filtro", async () => {
    const slug = await slugInativo();
    for (const q of [
      anon.from("cafes").select("slug").eq("slug", slug),
      anon.from("cafes").select("slug").eq("ativo", false),
      anon.from("cafes").select("slug").or("ativo.eq.false,ativo.eq.true").eq("slug", slug),
      anon.from("cafes").select("slug").not("ativo", "is", true).eq("slug", slug),
    ]) {
      const { data, error } = await q;
      expect(error).toBeNull(); // a RLS filtra em silêncio, não dá erro
      expect(data ?? []).toEqual([]);
    }
  });

  it("não insere, não atualiza, não apaga, não faz upsert", async () => {
    const ins = await anon.from("cafes").insert({ slug: `hack-${Date.now()}`, nome: "x" });
    const upd = await anon.from("cafes").update({ nome: "hack" }).eq("ativo", true);
    const del = await anon.from("cafes").delete().eq("ativo", true);
    const ups = await anon.from("cafes").upsert({ slug: "81-coffee-co", nome: "sequestrado" });
    // Negado (erro) ou sem efeito (0 linhas): nunca uma escrita que valeu.
    for (const r of [ins, upd, del, ups]) {
      expect(r.error === null ? (r.count ?? 0) === 0 : true).toBe(true);
    }
    // Conferência por fora da RLS: nada mudou.
    const { data } = await serviceClient().from("cafes").select("nome").eq("slug", "81-coffee-co").single();
    expect(data?.nome).not.toBe("sequestrado");
  });

  it("não lê cafe_fotos (nome, autorização — tudo é só do admin)", async () => {
    const { data, error } = await anon.from("cafe_fotos").select("id,autorizado_por,observacao");
    // Sem grant para anon: erro de permissão, ou lista vazia. Nunca dados.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("não grava em cafe_fotos", async () => {
    const { data: cafe } = await serviceClient().from("cafes").select("id").eq("ativo", true).limit(1).single();
    const r = await anon
      .from("cafe_fotos")
      .insert({ cafe_id: cafe!.id, storage_path: `${cafe!.id}/x.webp`, ordem: 0, origem: "propria", autorizado_por: "x", autorizado_em: "2026-01-01" });
    expect(r.error).not.toBeNull();
  });
});

escrita("usuário autenticado SEM papel de admin", () => {
  const criados: string[] = [];
  let comum: SupabaseClient;
  let fakeAdmin: SupabaseClient; // user_metadata.role=admin — não pode valer
  // Login por email vem desligado num projeto novo; sem ele, não há como obter
  // uma sessão autenticada. Pula com aviso, em vez de falhar a suíte toda.
  let indisponivel: string | null = null;

  beforeAll(async () => {
    try {
      const u1 = await criarUsuario("comum");
      const u2 = await criarUsuario("fake-admin", { userMetadata: { role: "admin" } });
      criados.push(u1.id, u2.id);
      comum = await clientAutenticado(u1);
      fakeAdmin = await clientAutenticado(u2);
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      if (/email logins are disabled/i.test(msg)) {
        indisponivel = "login por email desligado no projeto descartável (habilite external_email_enabled)";
        console.warn(`[security] usuário autenticado pulado: ${indisponivel}`);
      } else {
        throw erro;
      }
    }
  });

  afterAll(async () => {
    for (const id of criados) await apagarUsuario(id);
  });

  const casos = (): [string, () => SupabaseClient][] => [
    ["usuário comum (aal1)", () => comum],
    ["com user_metadata.role=admin (aal1)", () => fakeAdmin],
  ];

  for (const [rotulo, cliente] of casos()) {
    it(`${rotulo} não lê café inativo`, async (ctx) => {
      if (indisponivel) return ctx.skip();
      const slug = await slugInativo();
      const { data } = await cliente().from("cafes").select("slug").eq("slug", slug);
      expect(data ?? []).toEqual([]);
    });

    it(`${rotulo} não escreve em cafes`, async (ctx) => {
      if (indisponivel) return ctx.skip();
      const ins = await cliente().from("cafes").insert({ slug: `hack2-${Date.now()}`, nome: "x" });
      const upd = await cliente().from("cafes").update({ ativo: false }).eq("ativo", true);
      expect(ins.error !== null || (ins.count ?? 0) === 0).toBe(true);
      expect(upd.error !== null || (upd.count ?? 0) === 0).toBe(true);
    });

    it(`${rotulo} não escreve em cafe_fotos`, async (ctx) => {
      if (indisponivel) return ctx.skip();
      const { data: cafe } = await serviceClient().from("cafes").select("id").eq("ativo", true).limit(1).single();
      const r = await cliente()
        .from("cafe_fotos")
        .insert({ cafe_id: cafe!.id, storage_path: `${cafe!.id}/y.webp`, ordem: 0, origem: "propria", autorizado_por: "x", autorizado_em: "2026-01-01" });
      expect(r.error).not.toBeNull();
    });
  }
});
