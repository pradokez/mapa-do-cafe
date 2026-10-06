import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Envio público de sugestão (#83). O client do Supabase e os headers são
 * dublês: o que se prova é o que chega (ou não) ao banco, e o que a pessoa vê.
 */

vi.mock("server-only", () => ({}));

const cabecalhos = vi.hoisted(() => ({ atual: new Headers() }));
vi.mock("next/headers", () => ({ headers: () => cabecalhos.atual }));

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ createAnonClient: () => ({ rpc, from }) }));

import { ENVIO_INICIAL, hashDoIp } from "./sugestao";
import { enviarSugestao } from "./sugestoes-actions";

const SEGREDO = "segredo-de-teste-com-32-bytes-ok";
const IP = "200.17.1.30";

function form(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

const VALIDO = { tipo: "problema", mensagem: "  O botão Como chegar\r\nnão abre nada.​  ", origem: "/cafes/castelinho", site: "" };

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUGESTOES_IP_SECRET", SEGREDO);
  cabecalhos.atual = new Headers({ "x-forwarded-for": `${IP}, 10.0.0.1` });
  rpc.mockResolvedValue({ data: null, error: null });
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  vi.unstubAllEnvs();
});

describe("enviarSugestao", () => {
  it("envio válido: só rpc('enviar_sugestao'), com o texto normalizado e o hash do primeiro IP", async () => {
    const r = await enviarSugestao(ENVIO_INICIAL, form(VALIDO));

    expect(r.status).toBe("enviado");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("enviar_sugestao", {
      p_tipo: "problema",
      p_mensagem: "O botão Como chegar\nnão abre nada.",
      p_origem: "/cafes/castelinho",
      p_ip_hash: await hashDoIp(IP, SEGREDO),
    });
  });

  it("entrada inválida nunca chega ao banco: volta com os erros por campo e o que foi digitado", async () => {
    const r = await enviarSugestao(ENVIO_INICIAL, form({ ...VALIDO, tipo: "", mensagem: "curta" }));

    expect(r).toEqual({
      status: "erro",
      erros: { tipo: "Escolha o tipo da mensagem.", mensagem: "Escreva pelo menos 10 caracteres." },
      valores: { tipo: "", mensagem: "curta" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("honeypot preenchido: responde como sucesso, mas nada é gravado", async () => {
    const r = await enviarSugestao(ENVIO_INICIAL, form({ ...VALIDO, site: "https://spam.biz" }));

    expect(r.status).toBe("enviado");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("6º envio na hora (MC429 do banco): mensagem de limite, com o texto preservado — não um erro genérico", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "MC429", message: "limite de envios atingido" } });

    const r = await enviarSugestao(ENVIO_INICIAL, form(VALIDO));

    expect(r).toEqual({ status: "limite", erros: {}, valores: { tipo: "problema", mensagem: VALIDO.mensagem } });
  });

  it("outro erro do banco: falha geral, sem detalhe técnico para o público; o log leva o código, não o texto", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "violates check constraint" } });

    const r = await enviarSugestao(ENVIO_INICIAL, form(VALIDO));

    expect(r).toEqual({ status: "falha", erros: {}, valores: { tipo: "problema", mensagem: VALIDO.mensagem } });
    expect(log).toHaveBeenCalled();
    const registrado = JSON.stringify(log.mock.calls);
    expect(registrado).toContain("23514");
    expect(registrado).not.toContain("Como chegar");
    expect(registrado).not.toContain(IP);
  });

  it("banco fora do ar (o client lança): falha geral, sem rejeitar a action", async () => {
    rpc.mockRejectedValue(new TypeError("fetch failed"));

    expect((await enviarSugestao(ENVIO_INICIAL, form(VALIDO))).status).toBe("falha");
  });

  it("sem SUGESTOES_IP_SECRET: falha fechada — não grava sem o limite valer", async () => {
    vi.stubEnv("SUGESTOES_IP_SECRET", "");

    expect((await enviarSugestao(ENVIO_INICIAL, form(VALIDO))).status).toBe("falha");
    expect(rpc).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("sem x-forwarded-for, usa o x-real-ip", async () => {
    cabecalhos.atual = new Headers({ "x-real-ip": IP });

    await enviarSugestao(ENVIO_INICIAL, form(VALIDO));

    expect(rpc).toHaveBeenCalledWith("enviar_sugestao", expect.objectContaining({ p_ip_hash: await hashDoIp(IP, SEGREDO) }));
  });

  it("sem IP nenhum: falha fechada", async () => {
    cabecalhos.atual = new Headers({ "x-forwarded-for": " , " });

    expect((await enviarSugestao(ENVIO_INICIAL, form(VALIDO))).status).toBe("falha");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("o IP nunca vai ao banco, nem em parte", async () => {
    await enviarSugestao(ENVIO_INICIAL, form(VALIDO));

    expect(JSON.stringify(rpc.mock.calls)).not.toContain("200.17");
  });
});
