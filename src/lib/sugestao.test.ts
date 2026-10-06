import { describe, expect, it } from "vitest";

import {
  acoesDoStatus,
  alternarStatus,
  contadorDaMensagem,
  formatarDataDaSugestao,
  hashDoIp,
  origemSegura,
  rotuloDeNovas,
  statusDoFiltro,
  validarSugestao,
} from "./sugestao";

const valida = { tipo: "problema", mensagem: "O botão de Como chegar não abre nada.", origem: "/", site: "" };

describe("validarSugestao", () => {
  it("sugestão válida passa com tipo, mensagem e origem", () => {
    expect(validarSugestao(valida)).toEqual({
      ok: true,
      dados: { tipo: "problema", mensagem: "O botão de Como chegar não abre nada.", origem: "/" },
    });
  });

  const erroDaMensagem = (mensagem: string) => {
    const r = validarSugestao({ ...valida, mensagem });
    return r.ok || r.robo ? undefined : r.erros.mensagem;
  };

  it("mensagem vazia, curta ou longa demais é recusada com frase própria", () => {
    expect(erroDaMensagem("")).toBe("Escreva sua mensagem.");
    expect(erroDaMensagem("não abre")).toBe("Escreva pelo menos 10 caracteres.");
    expect(erroDaMensagem("a".repeat(501))).toBe("Passou de 500 caracteres. Corte um pouco.");
  });

  it("10 e 500 caracteres são os limites aceitos", () => {
    expect(erroDaMensagem("a".repeat(10))).toBeUndefined();
    expect(erroDaMensagem("a".repeat(500))).toBeUndefined();
  });

  it("o tamanho é medido depois de aparar: espaços nas pontas não contam", () => {
    expect(erroDaMensagem("   não abre   ")).toBe("Escreva pelo menos 10 caracteres.");
    expect(erroDaMensagem(`  ${"a".repeat(500)}\n\n`)).toBeUndefined();
  });

  it("texto só de espaços ou de caracteres invisíveis conta como vazio", () => {
    expect(erroDaMensagem("   \n\n\t  ")).toBe("Escreva sua mensagem.");
    expect(erroDaMensagem("​​‍⁠﻿‮⁦\u0007".repeat(5))).toBe("Escreva sua mensagem.");
  });

  it("emoji conta como um caractere (como o char_length do banco), não pelos bytes", () => {
    expect(erroDaMensagem("☕".repeat(10))).toBeUndefined();
    expect(erroDaMensagem("😀".repeat(500))).toBeUndefined();
    expect(erroDaMensagem("😀".repeat(501))).toBe("Passou de 500 caracteres. Corte um pouco.");
  });
});

describe("texto guardado", () => {
  const guardado = (mensagem: string) => {
    const r = validarSugestao({ ...valida, mensagem });
    if (!r.ok) throw new Error("devia passar");
    return r.dados.mensagem;
  };

  it("quebras do Windows viram \\n e 3+ linhas em branco viram uma só", () => {
    expect(guardado("Primeira linha\r\nsegunda\r\n\r\n\r\n\r\nterceira")).toBe("Primeira linha\nsegunda\n\nterceira");
  });

  it("caracteres invisíveis somem do meio do texto (sem esconder nem inverter nada)", () => {
    expect(guardado("Café​ ótimo,‮ mas⁦ fecha cedo")).toBe("Café ótimo, mas fecha cedo");
  });

  it("acentos ficam na forma composta (NFC): o mesmo texto digitado em sistemas diferentes é igual", () => {
    const decomposto = "Café com pão na Graças";
    expect(guardado(decomposto)).toBe("Café com pão na Graças");
  });

  it("HTML e aspas são guardados como escritos — a segurança está na saída, não em mutilar o texto", () => {
    expect(guardado('<script>alert("oi")</script> e um <3')).toBe('<script>alert("oi")</script> e um <3');
    expect(guardado("Robert'); drop table sugestoes;--")).toBe("Robert'); drop table sugestoes;--");
  });

  it("tab no meio do texto fica", () => {
    expect(guardado("coluna 1\tcoluna 2")).toBe("coluna 1\tcoluna 2");
  });
});

describe("tipo e robôs", () => {
  it("aceita os três tipos", () => {
    for (const tipo of ["sugestao", "problema", "outro"]) {
      expect(validarSugestao({ ...valida, tipo }).ok).toBe(true);
    }
  });

  it("tipo ausente ou fora da lista é recusado, junto com o erro da mensagem", () => {
    for (const tipo of [undefined, "", "elogio", "SUGESTAO", 1]) {
      expect(validarSugestao({ ...valida, tipo, mensagem: "curta" })).toEqual({
        ok: false,
        erros: { tipo: "Escolha o tipo da mensagem.", mensagem: "Escreva pelo menos 10 caracteres." },
      });
    }
  });

  it("honeypot preenchido: é robô, mesmo com o resto válido", () => {
    expect(validarSugestao({ ...valida, site: "https://spam.biz" })).toEqual({ ok: false, robo: true });
    expect(validarSugestao({ ...valida, mensagem: "", site: "x" })).toEqual({ ok: false, robo: true });
  });
});

describe("origemSegura", () => {
  it("aceita a home e a página de um café", () => {
    expect(origemSegura("/")).toBe("/");
    expect(origemSegura("/cafes/borsoi-cafe-riomar")).toBe("/cafes/borsoi-cafe-riomar");
  });

  it("qualquer outra coisa vira null: externo, protocolo, //host, .., query, hash, outra rota, lixo", () => {
    for (const valor of [
      "https://mapadocafe-pe.com.br/",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "/cafes/../admin",
      "/cafes/a/b",
      "/?pets=true",
      "/cafes/castelinho?x=1",
      "/cafes/castelinho#horario",
      "/cafes/",
      "/cafes/Castelinho",
      "/cafes/cafe--duplo",
      "/admin",
      "/sugestoes",
      ["/"],
      "",
      " /",
      `/cafes/${"a".repeat(81)}`,
      undefined,
      null,
      42,
    ]) {
      expect(origemSegura(valor), String(valor)).toBeNull();
    }
  });

  it("validarSugestao só deixa passar origem segura", () => {
    const r = validarSugestao({ ...valida, origem: "https://spam.biz" });
    expect(r.ok && r.dados.origem).toBeNull();
    const semOrigem = validarSugestao({ ...valida, origem: undefined });
    expect(semOrigem.ok && semOrigem.dados.origem).toBeNull();
  });
});

describe("hashDoIp", () => {
  const SEGREDO = "segredo-de-teste-com-32-bytes-ok";

  it("mesmo IP e segredo dão o mesmo hash, em hex de 64 caracteres (HMAC-SHA-256)", async () => {
    const a = await hashDoIp("200.17.1.30", SEGREDO);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashDoIp("200.17.1.30", SEGREDO)).toBe(a);
  });

  it("IP diferente ou segredo diferente dão outro hash", async () => {
    const a = await hashDoIp("200.17.1.30", SEGREDO);
    expect(await hashDoIp("200.17.1.31", SEGREDO)).not.toBe(a);
    expect(await hashDoIp("200.17.1.30", "outro-segredo")).not.toBe(a);
  });

  it("o IP não aparece no resultado e o hash não é o SHA-256 puro do IP (sem segredo, daria para reverter)", async () => {
    const ip = "2804:14c:5b80:8000::1";
    const h = await hashDoIp(ip, SEGREDO);
    expect(h).not.toContain(ip);
    const puro = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))).toString("hex");
    expect(h).not.toBe(puro);
  });
});

describe("contadorDaMensagem", () => {
  it("diz quantos restam, com milhar em ponto, e conta o texto já normalizado", () => {
    expect(contadorDaMensagem("")).toEqual({ rotulo: "500 restantes", restantes: 500 });
    expect(contadorDaMensagem("  oi\u200B  ")).toEqual({ rotulo: "498 restantes", restantes: 498 });
    expect(contadorDaMensagem("a".repeat(499)).rotulo).toBe("1 restante");
  });

  it("acima do limite, diz quantos passaram", () => {
    expect(contadorDaMensagem("a".repeat(512))).toEqual({ rotulo: "12 a mais", restantes: -12 });
    expect(contadorDaMensagem("a".repeat(2000)).rotulo).toBe("1.500 a mais");
  });
});

describe("statusDoFiltro", () => {
  it("sem param, mostra novas e lidas (arquivadas só sob demanda)", () => {
    expect(statusDoFiltro(undefined)).toEqual(["nova", "lida"]);
  });

  it("lê os status separados por vírgula, na ordem nova → lida → arquivada", () => {
    expect(statusDoFiltro("arquivada")).toEqual(["arquivada"]);
    expect(statusDoFiltro("arquivada,nova")).toEqual(["nova", "arquivada"]);
  });

  it("status desconhecido é ignorado; nada válido cai no padrão", () => {
    expect(statusDoFiltro("lida,apagada")).toEqual(["lida"]);
    expect(statusDoFiltro("")).toEqual(["nova", "lida"]);
    expect(statusDoFiltro("<script>")).toEqual(["nova", "lida"]);
  });

  it("param repetido vale o primeiro", () => {
    expect(statusDoFiltro(["arquivada", "nova"])).toEqual(["arquivada"]);
  });
});

describe("alternarStatus", () => {
  it("liga o status desligado e desliga o ligado, na ordem dos chips", () => {
    expect(alternarStatus(["nova", "lida"], "arquivada")).toEqual(["nova", "lida", "arquivada"]);
    expect(alternarStatus(["nova", "lida"], "nova")).toEqual(["lida"]);
    expect(alternarStatus(["arquivada"], "nova")).toEqual(["nova", "arquivada"]);
  });

  it("o último status ligado não desliga: o filtro nunca fica vazio", () => {
    expect(alternarStatus(["lida"], "lida")).toEqual(["lida"]);
  });
});

describe("acoesDoStatus", () => {
  it("nova: marcar como lida ou arquivar", () => {
    expect(acoesDoStatus("nova")).toEqual([
      { rotulo: "Marcar como lida", para: "lida" },
      { rotulo: "Arquivar", para: "arquivada" },
    ]);
  });

  it("lida: voltar para nova ou arquivar", () => {
    expect(acoesDoStatus("lida")).toEqual([
      { rotulo: "Voltar para nova", para: "nova" },
      { rotulo: "Arquivar", para: "arquivada" },
    ]);
  });

  it("arquivada: desarquivar leva a lida", () => {
    expect(acoesDoStatus("arquivada")).toEqual([{ rotulo: "Desarquivar", para: "lida" }]);
  });
});

describe("formatarDataDaSugestao", () => {
  // 23:30 de 4 de outubro em Recife — já é dia 5 em UTC (o Vitest roda em UTC).
  const agora = new Date("2026-10-05T02:30:00Z");

  it("hoje e ontem pelo dia de Recife, não pelo do servidor", () => {
    expect(formatarDataDaSugestao("2026-10-04T17:32:00Z", agora)).toBe("Hoje, 14:32");
    expect(formatarDataDaSugestao("2026-10-05T01:00:00Z", agora)).toBe("Hoje, 22:00");
    expect(formatarDataDaSugestao("2026-10-04T02:07:00Z", agora)).toBe("Ontem, 23:07");
  });

  it("antes de ontem: dia e mês abreviado", () => {
    expect(formatarDataDaSugestao("2026-10-03T02:59:00Z", agora)).toBe("2 out, 23:59");
    expect(formatarDataDaSugestao("2026-09-30T06:12:00Z", agora)).toBe("30 set, 03:12");
  });

  it("de outro ano, com o ano", () => {
    expect(formatarDataDaSugestao("2025-10-03T11:15:00Z", agora)).toBe("3 out 2025, 08:15");
  });
});

describe("rotuloDeNovas", () => {
  it("singular e plural", () => {
    expect(rotuloDeNovas(1)).toBe("1 sugestão nova");
    expect(rotuloDeNovas(3)).toBe("3 sugestões novas");
    expect(rotuloDeNovas(1200)).toBe("1.200 sugestões novas");
  });
});
