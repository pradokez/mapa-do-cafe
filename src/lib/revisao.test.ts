import { describe, expect, it } from "vitest";

import {
  acoesDaRevisao,
  agruparPorCafe,
  alternarStatus,
  avisoDeConfirmacao,
  formatarUltimaRodada,
  formatarValor,
  mesmoValor,
  ordenarRevisoes,
  rotuloDeAtualidade,
  rotuloDePendentes,
  statusDoFiltro,
  type Revisao,
} from "./revisao";

const base: Revisao = {
  id: "r1",
  tipo: "atualizacao",
  cafe_id: "c1",
  campo: "telefone",
  valor_atual: "(81) 3071-6834",
  valor_proposto: "(81) 99908-4986",
  fontes: [],
  atualidade: "atualizada",
  status: "pendente",
  criado_em: "2026-10-20T12:00:00Z",
  decidido_em: null,
  cafe: { nome: "Café A", slug: "cafe-a", ativo: true },
  nome_proposto: null,
};
const rev = (p: Partial<Revisao>): Revisao => ({ ...base, ...p });

describe("filtro de status", () => {
  it("sem param ou com param inválido, valem as pendentes", () => {
    expect(statusDoFiltro(undefined)).toEqual(["pendente"]);
    expect(statusDoFiltro("xyz")).toEqual(["pendente"]);
  });

  it("lê vários, na ordem dos chips", () => {
    expect(statusDoFiltro("rejeitada,pendente,lixo")).toEqual(["pendente", "rejeitada"]);
  });

  it("o chip liga e desliga, mas o último ligado não desliga", () => {
    expect(alternarStatus(["pendente"], "aprovada")).toEqual(["pendente", "aprovada"]);
    expect(alternarStatus(["pendente", "aprovada"], "pendente")).toEqual(["aprovada"]);
    expect(alternarStatus(["pendente"], "pendente")).toEqual(["pendente"]);
  });
});

describe("ordenarRevisoes", () => {
  it("fechamento, depois café novo, depois atualização; mais recentes primeiro dentro do tipo", () => {
    const lista = [
      rev({ id: "a-velha", criado_em: "2026-10-01T00:00:00Z" }),
      rev({ id: "novo", tipo: "cafe_novo", cafe_id: null, campo: null }),
      rev({ id: "a-nova", criado_em: "2026-10-25T00:00:00Z" }),
      rev({ id: "fecha", tipo: "fechamento", campo: null }),
    ];
    expect(ordenarRevisoes(lista).map((r) => r.id)).toEqual(["fecha", "novo", "a-nova", "a-velha"]);
  });

  it("não muda a lista recebida", () => {
    const lista = [rev({ id: "x", tipo: "fechamento" }), rev({ id: "y", tipo: "cafe_novo" })];
    const copia = [...lista];
    ordenarRevisoes([lista[1], lista[0]]);
    expect(lista).toEqual(copia);
  });
});

describe("agruparPorCafe", () => {
  it("junta as revisões do mesmo café, na ordem em que o primeiro de cada café aparece", () => {
    const lista = ordenarRevisoes([
      rev({ id: "1", cafe_id: "c1" }),
      rev({ id: "2", cafe_id: "c2", cafe: { nome: "Café B", slug: "cafe-b", ativo: false }, tipo: "fechamento", campo: null }),
      rev({ id: "3", cafe_id: "c1", campo: "instagram" }),
    ]);
    const grupos = agruparPorCafe(lista);
    expect(grupos.map((g) => [g.cafe?.nome, g.revisoes.map((r) => r.id)])).toEqual([
      ["Café B", ["2"]],
      ["Café A", ["1", "3"]],
    ]);
  });

  it("cada café novo é um grupo próprio, com o nome da proposta", () => {
    const grupos = agruparPorCafe([
      rev({ id: "n1", tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null, nome_proposto: "Novo 1" }),
      rev({ id: "n2", tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null, nome_proposto: "Novo 2" }),
    ]);
    expect(grupos.map((g) => g.titulo)).toEqual(["Novo 1", "Novo 2"]);
  });
});

describe("rotuloDeAtualidade", () => {
  const agora = new Date("2026-10-28T12:00:00Z");
  const fonte = (data_fonte: string | null) => ({ url: "https://x", titulo: "t", data_fonte, trecho: "…", atualidade: "antiga" as const });

  it("atualizada, sem data e conflito têm texto próprio", () => {
    expect(rotuloDeAtualidade("atualizada", [], agora)).toBe("Atualizada");
    expect(rotuloDeAtualidade("sem_data", [], agora)).toBe("Sem data");
    expect(rotuloDeAtualidade("conflito", [], agora)).toBe("Fontes discordam");
  });

  it("antiga diz a idade da fonte mais recente quando a data é ISO", () => {
    expect(rotuloDeAtualidade("antiga", [fonte("2024-03-10"), fonte("2024-09-01")], agora)).toBe("Antiga · 2 anos");
    expect(rotuloDeAtualidade("antiga", [fonte("2026-02-01")], agora)).toBe("Antiga · 8 meses");
  });

  it("antiga com data que não é ISO fica só 'Antiga'", () => {
    expect(rotuloDeAtualidade("antiga", [fonte("12 de março de 2024")], agora)).toBe("Antiga");
    expect(rotuloDeAtualidade("antiga", [], agora)).toBe("Antiga");
  });
});

describe("formatarValor", () => {
  it("booleano vira Sim / Não e null, sem informação", () => {
    expect(formatarValor("aceita_pets", true)).toEqual(["Sim"]);
    expect(formatarValor("aceita_pets", false)).toEqual(["Não"]);
    expect(formatarValor("tem_ar_condicionado", null)).toEqual(["Sem informação"]);
  });

  it("horário sai em sete linhas, de segunda a domingo", () => {
    const horario = {
      domingo: "Fechado", sabado: "09:00 – 14:00", sexta: "08:00 – 18:00", quinta: "08:00 – 18:00",
      quarta: "08:00 – 18:00", terca: "08:00 – 18:00", segunda: "08:00 – 18:00",
    };
    const linhas = formatarValor("horario_funcionamento", horario);
    expect(linhas).toHaveLength(7);
    expect(linhas[0]).toBe("Segunda: 8h – 18h");
    expect(linhas[6]).toBe("Domingo: Fechado");
  });

  it("texto passa; vazio ou ausente é 'Sem informação'", () => {
    expect(formatarValor("instagram", "https://instagram.com/x")).toEqual(["https://instagram.com/x"]);
    expect(formatarValor("telefone", null)).toEqual(["Sem informação"]);
    expect(formatarValor("telefone", "")).toEqual(["Sem informação"]);
  });
});

describe("cartão do /admin", () => {
  it("rotulo de pendentes no singular e no plural", () => {
    expect(rotuloDePendentes(1)).toBe("1 revisão pendente");
    expect(rotuloDePendentes(12)).toBe("12 revisões pendentes");
  });

  it("última rodada em Recife: DD/MM, HH:MM", () => {
    expect(formatarUltimaRodada("2026-10-28T02:30:00Z")).toBe("27/10, 23:30");
  });
});

describe("mesmoValor", () => {
  it("compara pelo conteúdo, sem depender da ordem das chaves (o jsonb não a guarda)", () => {
    expect(mesmoValor({ segunda: "8:00", terca: "9:00" }, { terca: "9:00", segunda: "8:00" })).toBe(true);
    expect(mesmoValor({ segunda: "8:00" }, { segunda: "9:00" })).toBe(false);
    expect(mesmoValor(null, false)).toBe(false);
    expect(mesmoValor("@a", "@a")).toBe(true);
  });
});

describe("acoesDaRevisao", () => {
  it("atualização com campo e fechamento pendentes: Aprovar e Rejeitar", () => {
    expect(acoesDaRevisao(rev({}))).toEqual({ aprovar: true, descartar: "Rejeitar", verCafe: false });
    expect(acoesDaRevisao(rev({ tipo: "fechamento", campo: null }))).toEqual({
      aprovar: true,
      descartar: "Rejeitar",
      verCafe: false,
    });
  });

  it("fechado temporariamente (indício sem campo) não tem Aprovar: só Ver café e Arquivar", () => {
    expect(acoesDaRevisao(rev({ campo: null }))).toEqual({ aprovar: false, descartar: "Arquivar", verCafe: true });
  });

  it("café novo, nesta fatia, só se rejeita", () => {
    expect(acoesDaRevisao(rev({ tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null }))).toEqual({
      aprovar: false,
      descartar: "Rejeitar",
      verCafe: false,
    });
  });

  it.each(["aprovada", "rejeitada", "obsoleta"] as const)("revisão %s não tem ação", (status) => {
    expect(acoesDaRevisao(rev({ status }))).toEqual({ aprovar: false, descartar: null, verCafe: false });
  });
});

describe("avisoDeConfirmacao", () => {
  const agora = new Date("2026-10-28T12:00:00Z");
  const fonte = (data_fonte: string | null) => ({ url: "https://x", titulo: "x", data_fonte, trecho: "x", atualidade: "antiga" as const });

  it("atualizada se aprova num clique: sem aviso", () => {
    expect(avisoDeConfirmacao(rev({ atualidade: "atualizada" }), agora)).toBeNull();
  });

  it("antiga diz a idade da fonte mais recente, quando dá para saber", () => {
    expect(avisoDeConfirmacao(rev({ atualidade: "antiga", fontes: [fonte("2024-03-10"), fonte("2024-09-01")] }), agora)).toBe(
      "A fonte mais recente tem 2 anos.",
    );
    expect(avisoDeConfirmacao(rev({ atualidade: "antiga", fontes: [fonte("2026-02-01")] }), agora)).toBe(
      "A fonte mais recente tem 8 meses.",
    );
    expect(avisoDeConfirmacao(rev({ atualidade: "antiga", fontes: [fonte("março de 2024")] }), agora)).toBe(
      "A fonte mais recente é antiga.",
    );
  });

  it("sem data e conflito dizem por que pedem confirmação", () => {
    expect(avisoDeConfirmacao(rev({ atualidade: "sem_data" }), agora)).toBe("As fontes não têm data.");
    expect(avisoDeConfirmacao(rev({ atualidade: "conflito" }), agora)).toBe("As fontes discordam entre si.");
  });
});
