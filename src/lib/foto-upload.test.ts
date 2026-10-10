import { describe, expect, it } from "vitest";

import {
  caminhoDaArte,
  caminhoDaFoto,
  checarArquivo,
  checarWebp,
  dimensoesDestino,
  ERRO_HEIC,
  ehCaminhoDaEdicao,
  ehCaminhoDoCafe,
  hojeEmRecife,
  validarAutorizacao,
  validarAutorizacaoDaArte,
} from "./foto-upload";

const MB = 1024 * 1024;

describe("checarArquivo (foto escolhida, antes de converter)", () => {
  it("aceita JPEG, PNG e WebP até 15 MB", () => {
    expect(checarArquivo({ type: "image/jpeg", size: 8 * MB })).toBeNull();
    expect(checarArquivo({ type: "image/png", size: 15 * MB })).toBeNull();
    expect(checarArquivo({ type: "image/webp", size: 200_000 })).toBeNull();
  });

  it("recusa outro tipo com mensagem em pt-BR", () => {
    for (const type of ["image/gif", "application/pdf", ""]) {
      expect(checarArquivo({ type, size: MB })).toBe("Use uma foto JPEG, PNG ou WebP.");
    }
  });

  it("foto HEIC do iPhone (pelo tipo, ou pela extensão quando o tipo vem vazio): diz que é HEIC e como exportar", () => {
    expect(ERRO_HEIC).toMatch(/HEIC/);
    expect(ERRO_HEIC).toMatch(/JPEG/);
    expect(checarArquivo({ type: "image/heic", size: MB })).toBe(ERRO_HEIC);
    expect(checarArquivo({ type: "image/heif", size: MB })).toBe(ERRO_HEIC);
    expect(checarArquivo({ type: "", size: MB, name: "IMG_0001.HEIC" })).toBe(ERRO_HEIC);
    expect(checarArquivo({ type: "", size: MB, name: "foto.heif" })).toBe(ERRO_HEIC);
    expect(checarArquivo({ type: "", size: MB, name: "foto.gif" })).toBe("Use uma foto JPEG, PNG ou WebP.");
  });

  it("recusa acima de 15 MB", () => {
    expect(checarArquivo({ type: "image/jpeg", size: 15 * MB + 1 })).toBe("A foto tem mais de 15 MB.");
  });

  it("recusa arquivo vazio", () => {
    expect(checarArquivo({ type: "image/jpeg", size: 0 })).toBe("O arquivo está vazio.");
  });
});

describe("checarWebp (resultado da conversão, antes de subir)", () => {
  it("aceita WebP de até 2 MB", () => {
    expect(checarWebp({ type: "image/webp", size: 2 * MB })).toBeNull();
  });

  it("navegador que não gera WebP (devolve PNG) é recusado, pedindo outro navegador", () => {
    expect(checarWebp({ type: "image/png", size: 300_000 })).toBe(
      "Este navegador não consegue converter a foto para WebP. Use o Chrome, o Edge ou o Firefox.",
    );
  });

  it("WebP acima de 2 MB é recusado (o bucket recusaria de novo)", () => {
    expect(checarWebp({ type: "image/webp", size: 2 * MB + 1 })).toBe(
      "A foto convertida passou de 2 MB. Tente uma foto com menos detalhes.",
    );
  });
});

describe("dimensoesDestino (redimensionamento no navegador)", () => {
  it("paisagem grande: o lado maior vira 1600 px, mantendo a proporção", () => {
    expect(dimensoesDestino(4032, 3024)).toEqual({ largura: 1600, altura: 1200 });
  });

  it("retrato grande: idem, pela altura", () => {
    expect(dimensoesDestino(3024, 4032)).toEqual({ largura: 1200, altura: 1600 });
  });

  it("foto menor que 1600 px não é ampliada", () => {
    expect(dimensoesDestino(1200, 800)).toEqual({ largura: 1200, altura: 800 });
  });

  it("arredonda sem chegar a zero", () => {
    expect(dimensoesDestino(5000, 1)).toEqual({ largura: 1600, altura: 1 });
    expect(dimensoesDestino(1601, 1001)).toEqual({ largura: 1600, altura: 1000 });
  });
});

describe("hojeEmRecife", () => {
  it("é a data de Recife, não a do servidor (UTC): 22h de 4/10 em Recife ainda é dia 4", () => {
    expect(hojeEmRecife(new Date("2026-10-05T01:00:00Z"))).toBe("2026-10-04");
  });

  it("formato ISO do <input type=date>, com zero à esquerda", () => {
    expect(hojeEmRecife(new Date("2026-03-07T15:00:00Z"))).toBe("2026-03-07");
  });
});

describe("validarAutorizacao", () => {
  const HOJE = "2026-10-04";
  const valida = {
    origem: "cedida",
    autorizado_por: "  Ana, dona do café  ",
    autorizado_em: "2026-09-30",
    observacao: "  Por WhatsApp.  ",
  };

  it("autorização completa passa, com espaços aparados", () => {
    expect(validarAutorizacao(valida, HOJE)).toEqual({
      ok: true,
      valores: {
        origem: "cedida",
        autorizado_por: "Ana, dona do café",
        autorizado_em: "2026-09-30",
        observacao: "Por WhatsApp.",
      },
    });
  });

  it("observação é opcional: vazia vira null", () => {
    const r = validarAutorizacao({ ...valida, origem: "propria", observacao: "   " }, HOJE);
    expect(r.ok && r.valores.observacao).toBeNull();
    expect(validarAutorizacao({ ...valida, observacao: undefined }, HOJE).ok).toBe(true);
  });

  it("sem origem, quem autorizou e data, não passa — com um erro por campo", () => {
    expect(validarAutorizacao({ autorizado_por: "  ", autorizado_em: "" }, HOJE)).toEqual({
      ok: false,
      erros: {
        origem: "Escolha a origem da foto.",
        autorizado_por: "Diga quem autorizou.",
        autorizado_em: "Informe a data da autorização.",
      },
    });
  });

  it("origem fora de própria/cedida não passa", () => {
    const r = validarAutorizacao({ ...valida, origem: "instagram" }, HOJE);
    expect(r.ok ? null : r.erros.origem).toBe("Escolha a origem da foto.");
  });

  it("data no futuro (em Recife) ou inválida não passa; hoje passa", () => {
    const erro = (autorizado_em: string) => {
      const r = validarAutorizacao({ ...valida, autorizado_em }, HOJE);
      return r.ok ? null : r.erros.autorizado_em;
    };
    expect(erro(HOJE)).toBeNull();
    expect(erro("2026-10-05")).toBe("A data não pode ser no futuro.");
    expect(erro("2026-02-30")).toBe("Data inválida.");
    expect(erro("30/09/2026")).toBe("Data inválida.");
  });

  it("limites de tamanho: 120 em quem autorizou, 500 na observação", () => {
    const r = validarAutorizacao(
      { ...valida, autorizado_por: "a".repeat(121), observacao: "b".repeat(501) },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { autorizado_por: "Use até 120 caracteres.", observacao: "Use até 500 caracteres." },
    });
    expect(validarAutorizacao({ ...valida, autorizado_por: "a".repeat(120), observacao: "b".repeat(500) }, HOJE).ok).toBe(true);
  });

  it("entrada que não é texto (payload forjado) não quebra: vira campo faltando", () => {
    const r = validarAutorizacao({ origem: 1, autorizado_por: {}, autorizado_em: null, observacao: [] }, HOJE);
    expect(r.ok).toBe(false);
  });
});

describe("caminho no bucket", () => {
  const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
  const OUTRO = "0b3a4c1e-2d5f-4a6b-8c7d-9e0f1a2b3c4d";
  const FOTO = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

  it("é {cafe_id}/{uuid}.webp, e é reconhecido como do café", () => {
    const caminho = caminhoDaFoto(CAFE, FOTO);
    expect(caminho).toBe(`${CAFE}/${FOTO}.webp`);
    expect(ehCaminhoDoCafe(CAFE, caminho)).toBe(true);
  });

  it("caminho de outro café, outra extensão ou fora do formato é recusado", () => {
    for (const caminho of [
      `${OUTRO}/${FOTO}.webp`,
      `${CAFE}/${FOTO}.jpg`,
      `${CAFE}/../${OUTRO}/${FOTO}.webp`,
      `${CAFE}/sub/${FOTO}.webp`,
      `${CAFE}/${FOTO}.webp?x=1`,
      `/${CAFE}/${FOTO}.webp`,
      `${CAFE}/nao-e-uuid.webp`,
      "",
    ]) {
      expect(ehCaminhoDoCafe(CAFE, caminho), caminho).toBe(false);
    }
    expect(ehCaminhoDoCafe("nao-e-uuid", `nao-e-uuid/${FOTO}.webp`)).toBe(false);
    expect(ehCaminhoDoCafe(CAFE, 42)).toBe(false);
  });
});

describe("caminho da arte no bucket (#105)", () => {
  const EDICAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
  const OUTRA = "0b3a4c1e-2d5f-4a6b-8c7d-9e0f1a2b3c4d";
  const ARTE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

  it("é {edicao_id}/{uuid}.webp, e é reconhecido como da edição", () => {
    const caminho = caminhoDaArte(EDICAO, ARTE);
    expect(caminho).toBe(`${EDICAO}/${ARTE}.webp`);
    expect(ehCaminhoDaEdicao(EDICAO, caminho)).toBe(true);
  });

  it("caminho de outra edição, outra extensão ou fora do formato é recusado", () => {
    for (const caminho of [
      `${OUTRA}/${ARTE}.webp`,
      `${EDICAO}/${ARTE}.png`,
      `${EDICAO}/../${OUTRA}/${ARTE}.webp`,
      `${EDICAO}/sub/${ARTE}.webp`,
      `${EDICAO}/nao-e-uuid.webp`,
      "",
    ]) {
      expect(ehCaminhoDaEdicao(EDICAO, caminho), caminho).toBe(false);
    }
    expect(ehCaminhoDaEdicao(EDICAO, null)).toBe(false);
  });
});

describe("validarAutorizacaoDaArte (#105)", () => {
  const HOJE = "2026-10-04";

  it("quem autorizou e data bastam (a arte não tem origem nem observação)", () => {
    expect(validarAutorizacaoDaArte({ autorizado_por: "  ASCAPE  ", autorizado_em: "2026-10-01", origem: "x" }, HOJE)).toEqual({
      ok: true,
      valores: { autorizado_por: "ASCAPE", autorizado_em: "2026-10-01" },
    });
  });

  it("as mesmas regras das fotos: obrigatórios, até 120 caracteres, data sem futuro", () => {
    expect(validarAutorizacaoDaArte({}, HOJE)).toEqual({
      ok: false,
      erros: { autorizado_por: "Diga quem autorizou.", autorizado_em: "Informe a data da autorização." },
    });
    expect(validarAutorizacaoDaArte({ autorizado_por: "a".repeat(121), autorizado_em: "2026-10-05" }, HOJE)).toEqual({
      ok: false,
      erros: { autorizado_por: "Use até 120 caracteres.", autorizado_em: "A data não pode ser no futuro." },
    });
  });
});
