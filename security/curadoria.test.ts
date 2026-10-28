import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  apagarUsuario,
  clientAal2,
  clientAutenticado,
  criarUsuario,
  serviceClient,
  type UsuarioTeste,
} from "./clients";
import { CURADORIA_SEGREDO, motivoSemEscrita, PODE_ESCREVER } from "./env";

/**
 * Curadoria (#188, PRD #167): a fila de revisões e as portas do robô.
 *
 * - `revisoes` e `curadoria_rodadas`: só o admin (papel + aal2) lê, e só muda o
 *   `status` das revisões. Sem `delete`.
 * - `curadoria_contexto` e `curadoria_registrar`: o robô usa a publishable key
 *   (papel `anon`) e um segredo. Sem o segredo, nada; com ele, só propor —
 *   não aprova, não lê a fila nem as sugestões, não grava em `cafes`, e o teto
 *   de 24 h segura uma inundação.
 *
 * Escreve (revisões, rodadas, usuários): só no descartável, com o hash de
 * `SECURITY_CURADORIA_SEGREDO` gravado em `private.curadoria_segredo` lá.
 * Ver docs/security/pentest-2026-10-28.md.
 */

const ligar = PODE_ESCREVER && Boolean(CURADORIA_SEGREDO);
if (!ligar) {
  const motivo = PODE_ESCREVER ? "defina SECURITY_CURADORIA_SEGREDO (segredo de teste do descartável)" : motivoSemEscrita;
  console.warn(`[security] Curadoria pulada: ${motivo}`);
}
const suite = ligar ? describe : describe.skip;

type Revisao = Record<string, unknown>;

const agora = () => new Date().toISOString();

function registrar(segredo: string | null, revisoes: Revisao[], client: SupabaseClient = anonClient()) {
  return client.rpc("curadoria_registrar", {
    p_segredo: segredo,
    p_rodada: { inicio: agora(), cafes_verificados: revisoes.length },
    p_revisoes: revisoes,
  });
}

async function contar(tabela: "revisoes" | "curadoria_rodadas"): Promise<number> {
  const { count, error } = await serviceClient().from(tabela).select("id", { count: "exact", head: true });
  if (error) throw new Error(`não contou ${tabela}: ${error.message}`);
  return count ?? 0;
}

/** Negado (erro) ou sem efeito (nenhuma linha devolvida): nunca uma escrita que valeu. */
function semEfeito(r: { error: unknown; data: unknown[] | null }): boolean {
  return r.error !== null || (r.data ?? []).length === 0;
}

let cafeA: { id: string; instagram: string | null };
let cafeB: { id: string };
let atualizacaoId: string;
let fechamentoId: string;

suite("curadoria (revisões, rodadas e as RPCs do robô)", () => {
  const criados: string[] = [];

  beforeAll(async () => {
    const service = serviceClient();
    // O teto é em 24 h móveis: sem limpar, rodar a suíte duas vezes no dia bate nele.
    // Só no descartável (`PODE_ESCREVER`).
    await service.from("revisoes").delete().not("id", "is", null);
    await service.from("curadoria_rodadas").delete().not("id", "is", null);

    const { data: cafes } = await service.from("cafes").select("id,instagram").eq("ativo", true).order("id").limit(2);
    [cafeA, cafeB] = cafes as [typeof cafeA, typeof cafeB];

    // A fixture entra pelo caminho do robô, com o segredo certo — e tentando
    // forçar status, data de decisão e id, que o banco tem de ignorar.
    const { error } = await registrar(CURADORIA_SEGREDO, [
      {
        tipo: "atualizacao",
        cafe_id: cafeA.id,
        campo: "instagram",
        valor_atual: cafeA.instagram,
        valor_proposto: "https://instagram.com/pentest188",
        fontes: [],
        atualidade: "atualizada",
        status: "aprovada",
        decidido_em: "2020-01-01T00:00:00Z",
        id: "00000000-0000-0000-0000-000000000188",
      },
      { tipo: "fechamento", cafe_id: cafeB.id, valor_proposto: { ativo: false }, fontes: [], atualidade: "atualizada" },
    ]);
    if (error) throw new Error(`fixture: curadoria_registrar falhou: ${error.code} ${error.message}`);

    const { data: revisoes } = await service.from("revisoes").select("id,tipo");
    atualizacaoId = revisoes!.find((r) => r.tipo === "atualizacao")!.id;
    fechamentoId = revisoes!.find((r) => r.tipo === "fechamento")!.id;
  });

  afterAll(async () => {
    for (const id of criados) await apagarUsuario(id);
  });

  describe("anônimo (publishable key, sem segredo)", () => {
    const anon = anonClient();

    it("não lê revisões nem rodadas", async () => {
      for (const tabela of ["revisoes", "curadoria_rodadas"]) {
        const { data, error } = await anon.from(tabela).select("*");
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
    });

    it("não insere, não atualiza, não apaga revisões nem rodadas", async () => {
      const antes = { revisoes: await contar("revisoes"), rodadas: await contar("curadoria_rodadas") };
      const tentativas = [
        anon.from("revisoes").update({ status: "aprovada" }).eq("id", atualizacaoId).select("id"),
        anon.from("revisoes").delete().eq("id", atualizacaoId).select("id"),
        anon
          .from("revisoes")
          .insert({ tipo: "fechamento", cafe_id: cafeA.id, valor_proposto: { ativo: false }, atualidade: "atualizada" })
          .select("id"),
        anon.from("curadoria_rodadas").insert({ cafes_verificados: 1 }).select("id"),
        anon.from("curadoria_rodadas").update({ erro: "hack" }).not("id", "is", null).select("id"),
        anon.from("curadoria_rodadas").delete().not("id", "is", null).select("id"),
      ];
      for (const r of await Promise.all(tentativas)) expect(semEfeito(r)).toBe(true);

      expect(await contar("revisoes")).toBe(antes.revisoes);
      expect(await contar("curadoria_rodadas")).toBe(antes.rodadas);
      const { data } = await serviceClient().from("revisoes").select("status").eq("id", atualizacaoId).single();
      expect(data?.status).toBe("pendente");
    });
  });

  describe("usuário autenticado sem papel de admin, e admin sem o segundo fator", () => {
    let comum: SupabaseClient;
    let fakeAdmin: SupabaseClient; // user_metadata.role=admin — não pode valer
    let adminAal1: SupabaseClient; // o papel certo, só com a senha

    beforeAll(async () => {
      const u1 = await criarUsuario("cur-comum");
      const u2 = await criarUsuario("cur-fake-admin", { userMetadata: { role: "admin" } });
      const u3 = await criarUsuario("cur-admin-aal1", { appMetadata: { role: "admin" } });
      criados.push(u1.id, u2.id, u3.id);
      [comum, fakeAdmin, adminAal1] = await Promise.all([u1, u2, u3].map(clientAutenticado));
    });

    const casos = (): [string, () => SupabaseClient][] => [
      ["usuário comum (aal1)", () => comum],
      ["com user_metadata.role=admin (aal1)", () => fakeAdmin],
      ["admin só com a senha (aal1)", () => adminAal1],
    ];

    for (const [rotulo, cliente] of casos()) {
      it(`${rotulo} não lê revisões nem rodadas`, async () => {
        for (const tabela of ["revisoes", "curadoria_rodadas"]) {
          const { data, error } = await cliente().from(tabela).select("id");
          expect(error).toBeNull(); // tem grant: a RLS filtra em silêncio
          expect(data ?? []).toEqual([]);
        }
      });

      it(`${rotulo} não muda o status nem apaga`, async () => {
        const upd = await cliente().from("revisoes").update({ status: "rejeitada" }).eq("id", atualizacaoId).select("id");
        const del = await cliente().from("revisoes").delete().eq("id", atualizacaoId).select("id");
        expect(semEfeito(upd)).toBe(true);
        expect(semEfeito(del)).toBe(true);
        const { data } = await serviceClient().from("revisoes").select("status").eq("id", atualizacaoId).single();
        expect(data?.status).toBe("pendente");
      });

      it(`${rotulo} não executa as RPCs do robô (grant só para anon), nem com o segredo`, async () => {
        const ctx = await cliente().rpc("curadoria_contexto", { p_segredo: CURADORIA_SEGREDO });
        const reg = await registrar(CURADORIA_SEGREDO, [], cliente());
        expect(ctx.error?.code).toBe("42501");
        expect(reg.error?.code).toBe("42501");
      });
    }
  });

  describe("admin (papel + aal2)", () => {
    let admin: SupabaseClient;

    beforeAll(async () => {
      const u: UsuarioTeste = await criarUsuario("cur-admin", { appMetadata: { role: "admin" } });
      criados.push(u.id);
      admin = await clientAal2(u);
    });

    it("lê as revisões e as rodadas", async () => {
      const revisoes = await admin.from("revisoes").select("id");
      const rodadas = await admin.from("curadoria_rodadas").select("id");
      expect(revisoes.error).toBeNull();
      expect(revisoes.data?.map((r) => r.id).sort()).toEqual([atualizacaoId, fechamentoId].sort());
      expect(rodadas.data?.length).toBe(1);
    });

    it("muda o status, e a data da decisão sai do banco", async () => {
      const { data, error } = await admin
        .from("revisoes")
        .update({ status: "rejeitada" })
        .eq("id", atualizacaoId)
        .select("status,decidido_em");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].status).toBe("rejeitada");
      expect(data![0].decidido_em).not.toBeNull();
    });

    it("não muda outra coluna além do status (grant de coluna)", async () => {
      for (const campos of [
        { valor_proposto: "https://instagram.com/hack" },
        { campo: "telefone" },
        { decidido_em: "2020-01-01T00:00:00Z" },
        { status: "aprovada", cafe_id: cafeB.id },
      ]) {
        const { error } = await admin.from("revisoes").update(campos).eq("id", fechamentoId).select("id");
        expect(error?.code).toBe("42501");
      }
      const { data } = await serviceClient().from("revisoes").select("status,valor_proposto,cafe_id").eq("id", fechamentoId).single();
      expect(data).toEqual({ status: "pendente", valor_proposto: { ativo: false }, cafe_id: cafeB.id });
    });

    it("não apaga nem insere revisões", async () => {
      const del = await admin.from("revisoes").delete().eq("id", fechamentoId).select("id");
      const ins = await admin
        .from("revisoes")
        .insert({ tipo: "fechamento", cafe_id: cafeA.id, valor_proposto: { ativo: false }, atualidade: "atualizada" })
        .select("id");
      expect(del.error?.code).toBe("42501");
      expect(ins.error?.code).toBe("42501");
      expect(await contar("revisoes")).toBe(2);
    });

    it("só lê as rodadas: não insere, não atualiza, não apaga", async () => {
      const tentativas = await Promise.all([
        admin.from("curadoria_rodadas").insert({ cafes_verificados: 1 }).select("id"),
        admin.from("curadoria_rodadas").update({ erro: "hack" }).not("id", "is", null).select("id"),
        admin.from("curadoria_rodadas").delete().not("id", "is", null).select("id"),
      ]);
      for (const r of tentativas) expect(r.error?.code).toBe("42501");
      expect(await contar("curadoria_rodadas")).toBe(1);
    });
  });

  describe("RPCs com o segredo errado", () => {
    const errados: [string, string | null][] = [
      ["errado", "0".repeat(64)],
      ["vazio", ""],
      ["nulo", null],
      ["o próprio hash", "1695619b399524fcd7bc53374f52f99e6b5ee886c4918db1cda71b16374bd975"],
      ["o certo com um espaço", `${CURADORIA_SEGREDO} `],
      ["o certo em maiúsculas", CURADORIA_SEGREDO.toUpperCase()],
    ];

    for (const [rotulo, segredo] of errados) {
      it(`segredo ${rotulo} → MC401, sem ler nem gravar`, async () => {
        const antes = await contar("curadoria_rodadas");
        const ctx = await anonClient().rpc("curadoria_contexto", { p_segredo: segredo });
        const reg = await registrar(segredo, [
          { tipo: "fechamento", cafe_id: cafeA.id, valor_proposto: { ativo: false }, atualidade: "atualizada" },
        ]);
        expect(ctx.error?.code).toBe("MC401");
        expect(ctx.data).toBeNull();
        expect(reg.error?.code).toBe("MC401");
        expect(await contar("curadoria_rodadas")).toBe(antes);
      });
    }
  });

  describe("RPCs com o segredo certo: o robô só propõe", () => {
    it("o contexto traz só o mínimo dos cafés", async () => {
      const { data, error } = await anonClient().rpc("curadoria_contexto", { p_segredo: CURADORIA_SEGREDO });
      expect(error).toBeNull();
      expect(Object.keys(data).sort()).toEqual(["cafes", "cafes_novos_rejeitados", "rejeitadas"]);
      const permitidas = new Set([
        "id", "nome", "bairro", "cidade", "ativo", "endereco", "aceita_pets", "tem_estacionamento",
        "permite_coffee_office", "acessivel_pcd", "opcoes_vegetarianas", "tem_ar_condicionado",
        "faixa_preco", "horario_funcionamento", "instagram", "telefone",
      ]);
      for (const cafe of data.cafes) {
        for (const chave of Object.keys(cafe)) expect(permitidas.has(chave), chave).toBe(true);
      }
    });

    it("revisão nasce pendente, com id e datas do banco, mesmo pedindo outra coisa", async () => {
      const { data } = await serviceClient().from("revisoes").select("id,status,decidido_em").eq("id", fechamentoId).single();
      expect(data?.status).toBe("pendente");
      expect(data?.decidido_em).toBeNull();
      const forjada = await serviceClient().from("revisoes").select("id").eq("id", "00000000-0000-0000-0000-000000000188");
      expect(forjada.data).toEqual([]);
    });

    it("registrar atualização e fechamento não muda cafes", async () => {
      const { data } = await serviceClient().from("cafes").select("id,ativo,instagram").in("id", [cafeA.id, cafeB.id]);
      const porId = Object.fromEntries((data ?? []).map((c) => [c.id, c]));
      expect(porId[cafeA.id].instagram).toBe(cafeA.instagram);
      expect(porId[cafeB.id].ativo).toBe(true);
    });

    it("a chave do robô não lê a fila, as rodadas nem as sugestões, e não aprova", async () => {
      const anon = anonClient();
      for (const tabela of ["revisoes", "curadoria_rodadas", "sugestoes", "sugestoes_envios"]) {
        const { data, error } = await anon.from(tabela).select("*");
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
      const aprovar = await anon.from("revisoes").update({ status: "aprovada" }).eq("id", fechamentoId).select("id");
      expect(semEfeito(aprovar)).toBe(true);
      const { data } = await serviceClient().from("revisoes").select("status").eq("id", fechamentoId).single();
      expect(data?.status).toBe("pendente");
    });

    it("a chave do robô não grava em cafes", async () => {
      const r = await anonClient().from("cafes").update({ ativo: false }).eq("id", cafeB.id).select("id");
      expect(semEfeito(r)).toBe(true);
    });
  });

  // Por último: consome o teto de 24 h (a fixture já usou 1 rodada e 2 revisões).
  describe("teto de 24 h (3 rodadas, 150 revisões)", () => {
    const enxurrada = (n: number): Revisao[] =>
      Array.from({ length: n }, (_, i) => ({
        tipo: "atualizacao",
        cafe_id: cafeA.id,
        campo: "instagram",
        valor_atual: cafeA.instagram,
        valor_proposto: `https://instagram.com/enxurrada${i}`,
        atualidade: "atualizada",
      }));

    it("151 revisões numa chamada → MC429, nada gravado", async () => {
      const { error } = await registrar(CURADORIA_SEGREDO, enxurrada(151));
      expect(error?.code).toBe("MC429");
      expect(await contar("revisoes")).toBe(2);
      expect(await contar("curadoria_rodadas")).toBe(1);
    });

    it("passar de 150 revisões em 24 h → MC429, e a chamada inteira se desfaz (rodada inclusive)", async () => {
      const { error } = await registrar(CURADORIA_SEGREDO, enxurrada(150));
      expect(error?.code).toBe("MC429");
      expect(await contar("revisoes")).toBe(2);
      expect(await contar("curadoria_rodadas")).toBe(1);
    });

    it("a 4ª rodada em 24 h → MC429", async () => {
      for (let i = 0; i < 2; i++) expect((await registrar(CURADORIA_SEGREDO, [])).error).toBeNull();
      const { error } = await registrar(CURADORIA_SEGREDO, []);
      expect(error?.code).toBe("MC429");
      expect(await contar("curadoria_rodadas")).toBe(3);
    });
  });
});
