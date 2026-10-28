import { describe, expect, it } from "vitest";
import { cafe } from "./cafe.fixture";
import { propostasDeAtualizacao, type FatosDoCafe, type Fato, type Rejeitada } from "./revisao-proposta";

const AGORA = new Date("2026-10-28T15:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const fonte = (url = "https://exemplo.com/a") => ({
  url,
  titulo: "Página",
  data_fonte: "10/10/2026",
  trecho: "trecho literal",
});
const fato = <T,>(valor: T, extra: Partial<Fato<T>> = {}): Fato<T> => ({ valor, fonte: fonte(), ...extra });

function propor(fatos: FatosDoCafe, atual = cafe("a"), rejeitadas: Rejeitada[] = []) {
  return propostasDeAtualizacao(fatos, atual, rejeitadas, AGORA);
}

describe("igual ao banco", () => {
  it("não propõe nada quando todos os fatos coincidem com o café", () => {
    const atual = cafe("a", {
      instagram: "https://instagram.com/cafe",
      telefone: "(81) 99908-4986",
      endereco: "Rua X, 1",
      faixa_preco: "$$",
      aceita_pets: true,
    });
    const fatos: FatosDoCafe = {
      instagram: [fato("@cafe")],
      telefone: [fato("81 99908-4986")],
      endereco: [fato("rua x,  1")],
      faixa_preco: [fato("$$")],
      aceita_pets: [fato(true)],
      horario_funcionamento: [fato({ segunda: "Fechado" })],
    };
    expect(propor(fatos, atual)).toEqual([]);
  });

  it("sem fatos, nada", () => {
    expect(propor({})).toEqual([]);
  });
});

describe("formato do banco", () => {
  it("Instagram vira a URL do perfil", () => {
    const [p] = propor({ instagram: [fato("@novo.cafe")] });
    expect(p).toMatchObject({ tipo: "atualizacao", campo: "instagram", valor_atual: null, valor_proposto: "https://instagram.com/novo.cafe" });
  });

  it("telefone sai como (81) 99908-4986", () => {
    const [p] = propor({ telefone: [fato("8199908-4986")] });
    expect(p).toMatchObject({ campo: "telefone", valor_proposto: "(81) 99908-4986" });
  });

  it("horário muda só os dias informados e mantém o resto do banco", () => {
    const atual = cafe("a", { horario_funcionamento: { ...cafe("x").horario_funcionamento, segunda: "08:00 – 18:00" } });
    const [p] = propor({ horario_funcionamento: [fato({ terca: "09:00 – 17:00" })] }, atual);
    expect(p).toMatchObject({ campo: "horario_funcionamento" });
    expect(p.tipo === "atualizacao" && p.campo === "horario_funcionamento" && p.valor_proposto).toMatchObject({
      segunda: "08:00 – 18:00",
      terca: "09:00 – 17:00",
      domingo: "Fechado",
    });
  });

  it("faixa de preço e endereço", () => {
    const ps = propor({ faixa_preco: [fato("$$$")], endereco: [fato("  Rua Y, 2 ")] });
    expect(ps.map((p) => [p.tipo === "atualizacao" && p.campo, p.tipo === "atualizacao" && "valor_proposto" in p && p.valor_proposto])).toEqual([
      ["endereco", "Rua Y, 2"],
      ["faixa_preco", "$$$"],
    ]);
  });
});

describe("inválido pelo cafe-dados é descartado", () => {
  it("Instagram de outro site, telefone sem DDD, faixa e dia fora do formato", () => {
    expect(
      propor({
        instagram: [fato("https://facebook.com/cafe")],
        telefone: [fato("12345")],
        faixa_preco: [fato("$$$$")],
        horario_funcionamento: [fato({ segunda: "das 8 às 18" })],
        endereco: [fato("   ")],
      }),
    ).toEqual([]);
  });

  it("dia inválido sai, os válidos ficam", () => {
    const ps = propor({ horario_funcionamento: [fato({ segunda: "lixo", terca: "09:00 – 17:00" })] });
    expect(ps).toHaveLength(1);
  });

  it("fonte inválida não entra na proposta, a válida sim", () => {
    const ps = propor({ telefone: [fato("12345"), fato("81 3071-6834", { fonte: fonte("https://b.com") })] });
    expect(ps).toHaveLength(1);
    expect(ps[0].tipo === "atualizacao" && ps[0].campo === "telefone" && ps[0].fontes.map((f) => f.url)).toEqual(["https://b.com"]);
  });
});

describe("atributos", () => {
  it("true → false só com negação explícita", () => {
    const atual = cafe("a", { aceita_pets: true });
    expect(propor({ aceita_pets: [fato(false)] }, atual)).toEqual([]);
    expect(propor({ aceita_pets: [fato(false, { negacao_explicita: false })] }, atual)).toEqual([]);
    const [p] = propor({ aceita_pets: [fato(false, { negacao_explicita: true })] }, atual);
    expect(p).toMatchObject({ campo: "aceita_pets", valor_atual: true, valor_proposto: false });
  });

  it("false → true basta a afirmação", () => {
    const [p] = propor({ tem_estacionamento: [fato(true)] });
    expect(p).toMatchObject({ campo: "tem_estacionamento", valor_proposto: true });
  });

  it("null → valor no ar-condicionado, com ou sem negação explícita", () => {
    expect(propor({ tem_ar_condicionado: [fato(true)] })[0]).toMatchObject({ campo: "tem_ar_condicionado", valor_atual: null, valor_proposto: true });
    expect(propor({ tem_ar_condicionado: [fato(false)] })[0]).toMatchObject({ valor_proposto: false });
  });

  it("ar-condicionado true → false também pede negação explícita", () => {
    const atual = cafe("a", { tem_ar_condicionado: true });
    expect(propor({ tem_ar_condicionado: [fato(false)] }, atual)).toEqual([]);
  });

  it("valor que não é booleano é descartado", () => {
    expect(propor({ aceita_pets: [fato("sim" as unknown as boolean)] })).toEqual([]);
  });
});

describe("endereço", () => {
  it("a proposta nunca carrega coordenadas", () => {
    const entrada = { endereco: [fato("Rua Y, 2", { lat: -8, lng: -34.9 } as never)] } as FatosDoCafe;
    const [p] = propor(entrada);
    expect(JSON.stringify(p)).not.toMatch(/lat|lng/);
  });
});

describe("fechamento", () => {
  it("permanente → fechamento", () => {
    const [p] = propor({ fechamento: [{ situacao: "permanente", fonte: fonte() }] });
    expect(p).toMatchObject({ tipo: "fechamento", cafe_id: "a" });
  });

  it("temporário → indício, sem campo", () => {
    const [p] = propor({ fechamento: [{ situacao: "temporario", fonte: fonte() }] });
    expect(p).toMatchObject({ tipo: "atualizacao", campo: null, indicio: "fechado_temporariamente" });
  });

  it("permanente e temporário juntos: o permanente vence", () => {
    const ps = propor({ fechamento: [{ situacao: "temporario", fonte: fonte() }, { situacao: "permanente", fonte: fonte("https://b.com") }] });
    expect(ps.map((p) => p.tipo)).toEqual(["fechamento"]);
  });

  it("café já fora do ar não gera fechamento", () => {
    expect(propor({ fechamento: [{ situacao: "permanente", fonte: fonte() }] }, cafe("a", { ativo: false }))).toEqual([]);
  });

  it("fechamento rejeitado há pouco não volta", () => {
    const rejeitada: Rejeitada = { cafe_id: "a", campo: "fechamento", valor: null, rejeitada_em: new Date(AGORA.getTime() - 10 * DIA) };
    expect(propor({ fechamento: [{ situacao: "permanente", fonte: fonte() }] }, cafe("a"), [rejeitada])).toEqual([]);
  });
});

describe("rejeitadas", () => {
  const rejeitadaHa = (dias: number, valor: unknown = "https://instagram.com/novo"): Rejeitada => ({
    cafe_id: "a",
    campo: "instagram",
    valor,
    rejeitada_em: new Date(AGORA.getTime() - dias * DIA),
  });

  it("rejeitado há 89 dias → nada; há 91 → volta", () => {
    const fatos = { instagram: [fato("@novo")] };
    expect(propor(fatos, cafe("a"), [rejeitadaHa(89)])).toEqual([]);
    expect(propor(fatos, cafe("a"), [rejeitadaHa(91)])).toHaveLength(1);
  });

  it("outro valor, outro campo ou outro café não bloqueiam", () => {
    const fatos = { instagram: [fato("@novo")] };
    expect(propor(fatos, cafe("a"), [rejeitadaHa(1, "https://instagram.com/outro")])).toHaveLength(1);
    expect(propor(fatos, cafe("a"), [{ ...rejeitadaHa(1), campo: "telefone" }])).toHaveLength(1);
    expect(propor(fatos, cafe("a"), [{ ...rejeitadaHa(1), cafe_id: "b" }])).toHaveLength(1);
  });

  it("horário rejeitado é comparado pelo conteúdo", () => {
    const atual = cafe("a");
    const proposto = { ...atual.horario_funcionamento, segunda: "08:00 – 18:00" };
    const r: Rejeitada = { cafe_id: "a", campo: "horario_funcionamento", valor: proposto, rejeitada_em: new Date(AGORA.getTime() - DIA) };
    expect(propor({ horario_funcionamento: [fato({ segunda: "08:00 – 18:00" })] }, atual, [r])).toEqual([]);
  });
});

describe("fontes que discordam", () => {
  it("aparecem todas, cada uma com o seu valor", () => {
    const [p] = propor({
      telefone: [fato("81 99908-4986", { fonte: fonte("https://a.com") }), fato("81 3071-6834", { fonte: fonte("https://b.com") })],
    });
    expect(p.tipo === "atualizacao" && p.campo === "telefone" && p.fontes.map((f) => [f.url, f.valor])).toEqual([
      ["https://a.com", "(81) 99908-4986"],
      ["https://b.com", "(81) 3071-6834"],
    ]);
    expect(p.tipo === "atualizacao" && p.campo === "telefone" && p.discordam).toBe(true);
  });

  it("uma fonte igual ao banco e outra diferente: propõe a diferente e mostra as duas", () => {
    const atual = cafe("a", { telefone: "(81) 3071-6834" });
    const [p] = propor({ telefone: [fato("81 3071-6834", { fonte: fonte("https://a.com") }), fato("81 99908-4986", { fonte: fonte("https://b.com") })] }, atual);
    expect(p).toMatchObject({ valor_proposto: "(81) 99908-4986", discordam: true });
    expect(p.tipo === "atualizacao" && p.campo === "telefone" && p.fontes).toHaveLength(2);
  });

  it("fontes que concordam não discordam", () => {
    const [p] = propor({ telefone: [fato("81 99908-4986"), fato("(81) 99908-4986", { fonte: fonte("https://b.com") })] });
    expect(p).toMatchObject({ discordam: false });
  });
});
