import { describe, expect, it } from "vitest";

import { cafe } from "./cafe.fixture";
import type { Edicao, Participacao } from "./festival";
import {
  cafesParaAdicionar,
  donoDoNumero,
  erroDePublicacao,
  normalizarPostInstagram,
  pendencias,
  statusNoAdmin,
  validarEdicao,
  validarParticipante,
} from "./festival-dados";

const EDICAO = { inicio: "2026-10-18", fim: "2026-11-15", descricao: "Combos a preço único.", preco: "34,90" };

describe("validarEdicao", () => {
  it("aceita a edição e tira o ano do início", () => {
    expect(validarEdicao(EDICAO)).toEqual({
      ok: true,
      valores: { ano: 2026, inicio: "2026-10-18", fim: "2026-11-15", descricao: "Combos a preço único.", preco: 3490 },
    });
  });

  it("recusa fim antes do início, com mensagem no campo do fim", () => {
    expect(validarEdicao({ ...EDICAO, fim: "2026-10-17" })).toEqual({
      ok: false,
      erros: { fim: "O fim não pode ser antes do início." },
    });
  });

  it("aceita edição de um dia só", () => {
    expect(validarEdicao({ ...EDICAO, fim: "2026-10-18" }).ok).toBe(true);
  });

  it("recusa data vazia, malformada ou que não existe", () => {
    for (const inicio of ["", "18/10/2026", "2026-02-30", "2026-13-01", undefined]) {
      expect(validarEdicao({ ...EDICAO, inicio })).toEqual({ ok: false, erros: { inicio: "Informe a data de início." } });
    }
    expect(validarEdicao({ ...EDICAO, fim: "" })).toEqual({ ok: false, erros: { fim: "Informe a data de fim." } });
  });

  it("entende o preço com vírgula, ponto ou sem centavos", () => {
    const preco = (texto: string) => {
      const r = validarEdicao({ ...EDICAO, preco: texto });
      return r.ok ? r.valores.preco : r.erros.preco;
    };
    expect(preco("34,90")).toBe(3490);
    expect(preco("34.90")).toBe(3490);
    expect(preco("R$ 34,9")).toBe(3490);
    expect(preco("45")).toBe(4500);
    expect(preco(" ")).toBeNull();
  });

  it("recusa preço zero, negativo ou ilegível", () => {
    for (const preco of ["0", "-10", "abc", "34,999", "1.234,50"]) {
      expect(validarEdicao({ ...EDICAO, preco })).toEqual({
        ok: false,
        erros: { preco: "Use um valor como 34,90." },
      });
    }
  });

  it("descrição vazia vira null; longa demais é recusada", () => {
    const vazia = validarEdicao({ ...EDICAO, descricao: "  " });
    expect(vazia.ok && vazia.valores.descricao).toBeNull();
    expect(validarEdicao({ ...EDICAO, descricao: "a".repeat(1001) })).toEqual({
      ok: false,
      erros: { descricao: "Use no máximo 1000 caracteres." },
    });
  });

  it("ignora chaves a mais e entrada que não é objeto", () => {
    const r = validarEdicao({ ...EDICAO, publicada: true, festival_id: "x" });
    expect(r.ok && Object.keys(r.valores).sort()).toEqual(["ano", "descricao", "fim", "inicio", "preco"]);
    expect(validarEdicao(null).ok).toBe(false);
  });
});

describe("normalizarPostInstagram", () => {
  it("aceita post e reel, com ou sem https e www, e limpa a URL", () => {
    expect(normalizarPostInstagram("https://www.instagram.com/p/DAbc_12-x/?igsh=MTZ1&utm_source=ig")).toEqual({
      ok: true,
      valor: "https://www.instagram.com/p/DAbc_12-x/",
    });
    expect(normalizarPostInstagram("instagram.com/reel/C9xyz")).toEqual({
      ok: true,
      valor: "https://www.instagram.com/reel/C9xyz/",
    });
    expect(normalizarPostInstagram("https://instagram.com/euamocafe/p/DAbc/")).toEqual({
      ok: true,
      valor: "https://www.instagram.com/p/DAbc/",
    });
  });

  it("vazio vira null", () => {
    expect(normalizarPostInstagram("  ")).toEqual({ ok: true, valor: null });
  });

  it("recusa perfil, outro site e esquema estranho", () => {
    for (const link of [
      "https://instagram.com/euamocafe",
      "@euamocafe",
      "https://evil.com/p/DAbc/",
      "https://instagram.com.evil.com/p/DAbc/",
      "javascript:alert(1)//instagram.com/p/x",
      "http://instagram.com/p/DAbc",
    ]) {
      expect(normalizarPostInstagram(link)).toEqual({ ok: false, erro: "Cole o link do post ou do reel no Instagram." });
    }
  });
});

describe("validarParticipante", () => {
  const CAMPOS = {
    numero: "13",
    nome_combo: " Espresso + bolo de rolo ",
    alt: "Combo 13: espresso e fatia de bolo de rolo.",
    instagram_url: "instagram.com/p/DAbc",
  };

  it("aceita e normaliza os campos", () => {
    expect(validarParticipante(CAMPOS, { temArte: false })).toEqual({
      ok: true,
      valores: {
        numero: 13,
        nome_combo: "Espresso + bolo de rolo",
        alt: "Combo 13: espresso e fatia de bolo de rolo.",
        instagram_url: "https://www.instagram.com/p/DAbc/",
      },
    });
  });

  it("todos os campos são opcionais sem arte: vazio vira null", () => {
    expect(validarParticipante({ numero: "", nome_combo: "", alt: "", instagram_url: "" }, { temArte: false })).toEqual({
      ok: true,
      valores: { numero: null, nome_combo: null, alt: null, instagram_url: null },
    });
  });

  it("com arte, o texto alternativo é obrigatório", () => {
    expect(validarParticipante({ ...CAMPOS, alt: " " }, { temArte: true })).toEqual({
      ok: false,
      erros: { alt: "Descreva a arte: o texto do combo está dentro da imagem." },
    });
  });

  it("número precisa ser inteiro positivo", () => {
    for (const numero of ["0", "-1", "1,5", "treze", "100000"]) {
      expect(validarParticipante({ ...CAMPOS, numero }, { temArte: false })).toEqual({
        ok: false,
        erros: { numero: "Use um número inteiro, como 13." },
      });
    }
  });

  it("limita nome do combo e alt aos tamanhos do banco", () => {
    expect(validarParticipante({ ...CAMPOS, nome_combo: "a".repeat(121), alt: "b".repeat(1001) }, { temArte: false })).toEqual({
      ok: false,
      erros: { nome_combo: "Use no máximo 120 caracteres.", alt: "Use no máximo 1000 caracteres." },
    });
  });
});

describe("donoDoNumero", () => {
  const participacoes = [
    { id: "a", numero: 13, cafe_id: "c1" },
    { id: "b", numero: null, cafe_id: "c2" },
  ];

  it("diz qual outro participante já usa o número", () => {
    expect(donoDoNumero(participacoes, "b", 13)?.cafe_id).toBe("c1");
  });

  it("o próprio participante e o número vazio não contam", () => {
    expect(donoDoNumero(participacoes, "a", 13)).toBeUndefined();
    expect(donoDoNumero(participacoes, "a", null)).toBeUndefined();
  });
});

const EDICAO_2026: Edicao = {
  id: "e1",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [],
};

// 12h em Recife (UTC−3).
const em = (dia: string) => new Date(`${dia}T15:00:00Z`);

describe("statusNoAdmin", () => {
  it("não publicada é rascunho, mesmo dentro do período", () => {
    expect(statusNoAdmin({ ...EDICAO_2026, publicada: false }, em("2026-10-20"))).toEqual({
      status: "rascunho",
      rotulo: "Rascunho",
    });
  });

  it("publicada: no ar desde a publicação (futura avisa o início), encerrada pelo dia de Recife", () => {
    expect(statusNoAdmin(EDICAO_2026, em("2026-10-17")).rotulo).toBe("No ar · começa em 18 out");
    expect(statusNoAdmin(EDICAO_2026, em("2026-10-18")).rotulo).toBe("No ar");
    expect(statusNoAdmin(EDICAO_2026, em("2026-11-15")).status).toBe("ativa");
    expect(statusNoAdmin(EDICAO_2026, em("2026-11-16")).rotulo).toBe("Encerrada");
    // 22h de 17/10 em Recife já é 18/10 em UTC: ainda não começou.
    expect(statusNoAdmin(EDICAO_2026, new Date("2026-10-18T01:00:00Z")).status).toBe("futura");
  });
});

describe("erroDePublicacao", () => {
  it("publicar exige preço", () => {
    expect(erroDePublicacao({ preco: null })).toBe("Preencha o preço do combo antes de publicar.");
    expect(erroDePublicacao({ preco: 3490 })).toBeNull();
  });
});

const participacao = (id: string, campos: Partial<Participacao> = {}): Participacao => ({
  id,
  cafe_id: `cafe-${id}`,
  numero: null,
  nome_combo: null,
  alt: null,
  instagram_url: null,
  arte: null,
  ...campos,
});

describe("pendencias", () => {
  it("conta quem está sem número e sem arte", () => {
    expect(
      pendencias([
        participacao("a", { numero: 1, arte: "https://x/a.webp" }),
        participacao("b", { numero: 2 }),
        participacao("c"),
      ]),
    ).toEqual({ semNumero: 1, semArte: 2 });
  });
});

describe("cafesParaAdicionar", () => {
  const cafes = [
    cafe("a", { nome: "Borsoi Café", bairro: "Pina" }),
    cafe("b", { nome: "Café Castigliani", bairro: "Graças" }),
    cafe("c", { nome: "Fora", ativo: false }),
    cafe("d", { nome: "Melhor Cantinho", bairro: "Várzea" }),
  ];

  it("só cafés no ar que ainda não participam", () => {
    expect(cafesParaAdicionar(cafes, [participacao("x", { cafe_id: "b" })], "").map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("busca por nome ou bairro, como no site", () => {
    expect(cafesParaAdicionar(cafes, [], "varzea").map((c) => c.id)).toEqual(["d"]);
    expect(cafesParaAdicionar(cafes, [], "borsoi pina").map((c) => c.id)).toEqual(["a"]);
  });
});
