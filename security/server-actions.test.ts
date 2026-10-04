import { existsSync, readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serviceClient } from "./clients";
import { APP_URL, motivoSemEscrita, PODE_ESCREVER } from "./env";

/**
 * Exploit de wire das Server Actions (#59): a camada estática
 * (`fronteiras.test.ts`) prova que cada action começa com `requireAdmin()`;
 * aqui a prova é de verdade. Com os action IDs do build, chamamos cada action
 * por `fetch` — sem cookie e com `Origin` de outro domínio (CSRF) — e conferimos
 * que nenhuma escreve. Requer um app rodando contra o projeto DESCARTÁVEL
 * (`SECURITY_APP_URL`) e um `pnpm build` (o manifesto dos action IDs).
 * Ver docs/security/pentest-2026-10.md.
 */

const MANIFESTO = ".next/server/server-reference-manifest.json";
const temManifesto = existsSync(MANIFESTO);
const ligar = PODE_ESCREVER && Boolean(APP_URL) && temManifesto;

if (!ligar) {
  const motivo = !APP_URL
    ? "defina SECURITY_APP_URL (app apontado para o descartável)"
    : !temManifesto
      ? "rode `pnpm build` antes (gera o manifesto dos action IDs)"
      : motivoSemEscrita;
  console.warn(`[security] Exploit de Server Actions pulado: ${motivo}`);
}

const suite = ligar ? describe : describe.skip;

function actionIds(): string[] {
  const node = JSON.parse(readFileSync(MANIFESTO, "utf8")).node ?? {};
  // Só as actions de páginas do admin (o login tem actions, mas sem escrita de dado).
  return Object.keys(node).filter((id) =>
    Object.keys(node[id].workers ?? {}).some((w) => w.includes("cafes/[id]") || w.includes("cafes/novo")),
  );
}

/** Dispara uma Server Action por HTTP, como um atacante faria. */
async function dispararAction(id: string, headers: Record<string, string>) {
  return fetch(`${APP_URL}/admin/cafes/alvo`, {
    method: "POST",
    redirect: "manual",
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", ...headers },
    body: JSON.stringify([
      "00000000-0000-0000-0000-000000000000",
      { nome: "INVADIDO", ativo: true, slug: "invadido" },
    ]),
  });
}

suite("Server Actions de escrita recusam sem sessão e cross-origin", () => {
  const service = serviceClient();
  let ids: string[] = [];
  let cafesAntes = 0;
  let fotosAntes = 0;
  // O app precisa estar no ar (apontado para o descartável). Se não responder,
  // pula com aviso em vez de falhar a suíte.
  let indisponivel: string | null = null;

  beforeAll(async () => {
    ids = actionIds();
    try {
      await fetch(`${APP_URL}/admin/login`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    } catch {
      indisponivel = `app não responde em ${APP_URL} (rode um next start apontado para o descartável)`;
      console.warn(`[security] exploit de Server Actions pulado: ${indisponivel}`);
    }
    const { count: c } = await service.from("cafes").select("*", { count: "exact", head: true });
    const { count: f } = await service.from("cafe_fotos").select("*", { count: "exact", head: true });
    cafesAntes = c ?? 0;
    fotosAntes = f ?? 0;
  });

  it("o build expõe os action IDs do admin", () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it("sem sessão, nenhuma action devolve sucesso (cai no login)", async (ctx) => {
    if (indisponivel) return ctx.skip();
    for (const id of ids) {
      const r = await dispararAction(id, {});
      const corpo = await r.text();
      // requireAdmin() → redirect("/admin/login"): nunca um corpo de sucesso.
      expect(corpo, id).not.toContain('"ok":true');
      expect(corpo.toLowerCase(), id).not.toContain("invadido");
    }
  });

  it("com Origin de outro domínio (CSRF), idem", async (ctx) => {
    if (indisponivel) return ctx.skip();
    for (const id of ids) {
      const r = await dispararAction(id, { Origin: "https://evil.example", Host: "mapadocafe-pe.com.br" });
      const corpo = await r.text();
      expect(corpo, id).not.toContain('"ok":true');
    }
  });

  it("nada foi escrito: contagem de cafes e cafe_fotos intacta, sem café 'INVADIDO'", async (ctx) => {
    if (indisponivel) return ctx.skip();
    const { count: c } = await service.from("cafes").select("*", { count: "exact", head: true });
    const { count: f } = await service.from("cafe_fotos").select("*", { count: "exact", head: true });
    expect(c).toBe(cafesAntes);
    expect(f).toBe(fotosAntes);
    const { data } = await service.from("cafes").select("slug").eq("slug", "invadido");
    expect(data ?? []).toEqual([]);
  });

  afterAll(async () => {
    // Rede de segurança: se algo tivesse escrito, limpa o café forjado.
    await service.from("cafes").delete().eq("slug", "invadido");
  });
});
