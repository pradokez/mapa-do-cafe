import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import { PRAZO_DO_SERVIDOR_MS, PrazoEsgotado } from "@/lib/prazo";

/**
 * Prazo das leituras públicas (#138). O client do Supabase é um dublê que se
 * comporta como o postgrest-js: responde depois de `atraso` ms e, se o
 * `abortSignal` dispara antes, resolve com o `AbortError` — sem lançar.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <F>(fn: F) => fn }));

const URL_DO_SUPABASE = "https://projeto.supabase.co";
const CHAVE = "sb_publishable_chave";

const banco = vi.hoisted(() => ({
  /** `null` = não responde nunca (só o abort o encerra). */
  atraso: 0 as number | null,
  resposta: { data: null as unknown, error: null as { code: string; message: string } | null },
}));

function consulta() {
  let signal: AbortSignal | undefined;
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => builder,
    overrideTypes: () => builder,
    abortSignal: (s: AbortSignal) => {
      signal = s;
      return builder;
    },
    then<R>(resolve: (valor: unknown) => R) {
      return new Promise((fim) => {
        const abortou = () =>
          fim({ data: null, error: { code: "", message: "AbortError: This operation was aborted" } });
        if (signal?.aborted) return abortou();
        signal?.addEventListener("abort", abortou);
        if (banco.atraso !== null) setTimeout(() => fim(banco.resposta), banco.atraso);
      }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase-server", () => ({
  createAnonClient: () => ({ from: consulta }),
  createSessionClient: () => ({ from: consulta }),
}));

import { getCafeBySlug, listCafesAtivos, listFestivais } from "./cafe-repository";

const LEITURAS: [string, () => Promise<unknown>][] = [
  ["listCafesAtivos", () => listCafesAtivos()],
  ["getCafeBySlug", () => getCafeBySlug("cafe-a")],
  ["listFestivais", () => listFestivais()],
];

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("SUPABASE_URL", URL_DO_SUPABASE);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", CHAVE);
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  banco.atraso = 0;
  banco.resposta = { data: [], error: null };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  log.mockRestore();
});

/** Captura a rejeição já, para o Node não reclamar de promessa sem `catch` enquanto o relógio anda. */
function emAndamento<T>(promessa: Promise<T>) {
  return promessa.then(
    (valor) => ({ ok: true as const, valor }),
    (erro: unknown) => ({ ok: false as const, erro }),
  );
}

describe("prazo das leituras públicas", () => {
  it.each(LEITURAS)("%s que não responde desiste aos 20 s com o erro de prazo", async (_, ler) => {
    banco.atraso = null;
    const resultado = emAndamento(ler());

    await vi.advanceTimersByTimeAsync(PRAZO_DO_SERVIDOR_MS);

    const fim = await resultado;
    expect(fim.ok).toBe(false);
    expect(!fim.ok && fim.erro).toBeInstanceOf(PrazoEsgotado);
  });

  it("ainda espera 1 ms antes do prazo", async () => {
    banco.atraso = null;
    let terminou = false;
    void emAndamento(listCafesAtivos()).then(() => (terminou = true));

    await vi.advanceTimersByTimeAsync(PRAZO_DO_SERVIDOR_MS - 1);
    expect(terminou).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(terminou).toBe(true);
  });

  it("leitura que responde antes do prazo devolve os dados, sem log", async () => {
    banco.atraso = 19_000;
    banco.resposta = { data: [cafe("b", { nome: "Bule" }), cafe("a", { nome: "Arábica" })], error: null };
    const resultado = emAndamento(listCafesAtivos());

    await vi.advanceTimersByTimeAsync(19_000);
    const fim = await resultado;
    expect(fim.ok && (fim.valor as { nome: string }[]).map((c) => c.nome)).toEqual(["Arábica", "Bule"]);

    await vi.advanceTimersByTimeAsync(PRAZO_DO_SERVIDOR_MS);
    expect(vi.getTimerCount()).toBe(0);
    expect(log).not.toHaveBeenCalled();
  });

  it("falha do banco lança um erro que não é o de prazo", async () => {
    banco.resposta = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    const resultado = emAndamento(getCafeBySlug("cafe-a"));
    await vi.advanceTimersByTimeAsync(0);
    const fim = await resultado;

    expect(fim.ok).toBe(false);
    expect(!fim.ok && fim.erro).toBeInstanceOf(Error);
    expect(!fim.ok && fim.erro).not.toBeInstanceOf(PrazoEsgotado);
  });

  it("registra a leitura, a etapa, o tempo e o código — sem URL nem chave", async () => {
    banco.atraso = null;
    const prazo = emAndamento(listFestivais());
    await vi.advanceTimersByTimeAsync(PRAZO_DO_SERVIDOR_MS);
    await prazo;

    banco.atraso = 120;
    banco.resposta = { data: null, error: { code: "57014", message: "canceling statement" } };
    const consulta = emAndamento(listCafesAtivos());
    await vi.advanceTimersByTimeAsync(120);
    await consulta;

    expect(log.mock.calls).toEqual([
      ["[carregamento] listFestivais falhou", { etapa: "prazo", ms: PRAZO_DO_SERVIDOR_MS, codigo: "prazo" }],
      ["[carregamento] listCafesAtivos falhou", { etapa: "consulta", ms: 120, codigo: "57014" }],
    ]);
    const tudo = JSON.stringify(log.mock.calls);
    expect(tudo).not.toContain(URL_DO_SUPABASE);
    expect(tudo).not.toContain(CHAVE);
  });
});
