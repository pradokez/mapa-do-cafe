import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe, DiaSemana } from "./cafe";

import { proximaAberturaLabel, resumoHorario } from "./cafe-hours";

// 2026-10-05 é uma segunda-feira. Meio-dia em Recife (UTC−3) = 15:00Z.
const em = (dia: number) => new Date(Date.UTC(2026, 9, 5 + dia, 15));
const SEGUNDA = em(0);

const SEMANA: Record<DiaSemana, string> = {
  segunda: "08:00 – 18:00",
  terca: "08:00 – 18:00",
  quarta: "08:00 – 18:00",
  quinta: "08:00 – 18:00",
  sexta: "08:00 – 22:00",
  sabado: "09:00 – 11:30, 16:00 – 20:00",
  domingo: "Fechado",
};

describe("resumoHorario › hoje", () => {
  it("dia com horário é 'aberto' e traz o horário de hoje", () => {
    expect(resumoHorario(SEMANA, SEGUNDA).hoje).toMatchObject({
      status: "aberto",
      horario: "08:00 – 18:00",
    });
  });

  it("dia 'Fechado' é 'fechado' e não tem horário", () => {
    expect(resumoHorario(SEMANA, em(6)).hoje).toMatchObject({ status: "fechado", horario: null });
  });

  // Um horário diferente por dia denuncia qualquer erro de índice.
  const DISTINTOS: Record<DiaSemana, string> = {
    segunda: "01:00 – 02:00",
    terca: "02:00 – 03:00",
    quarta: "03:00 – 04:00",
    quinta: "04:00 – 05:00",
    sexta: "05:00 – 06:00",
    sabado: "06:00 – 07:00",
    domingo: "07:00 – 08:00",
  };

  it.each([
    [0, "segunda"],
    [1, "terca"],
    [2, "quarta"],
    [3, "quinta"],
    [4, "sexta"],
    [5, "sabado"],
    [6, "domingo"],
  ] as const)("dia %i da semana (de segunda) é %s", (offset, dia) => {
    expect(resumoHorario(DISTINTOS, em(offset)).hoje.horario).toBe(DISTINTOS[dia]);
  });

  it("'hoje' é o dia em Recife, não em UTC: sábado 22h30 em Recife já é domingo em UTC", () => {
    const sabadoNoiteRecife = new Date("2026-10-11T01:30:00Z");

    expect(resumoHorario(DISTINTOS, sabadoNoiteRecife).hoje.horario).toBe(DISTINTOS.sabado);
  });

  it("à meia-noite de Recife o dia já virou", () => {
    const domingoMeiaNoiteRecife = new Date("2026-10-11T03:00:00Z");

    expect(resumoHorario(DISTINTOS, domingoMeiaNoiteRecife).hoje.horario).toBe(DISTINTOS.domingo);
  });
});

describe("resumoHorario › dias", () => {
  it("lista os 7 dias de Segunda a Domingo, mesmo com as chaves do jsonb fora de ordem", () => {
    const embaralhado = Object.fromEntries(Object.entries(SEMANA).reverse());

    expect(resumoHorario(embaralhado, SEGUNDA).dias.map(({ label, horario }) => [label, horario])).toEqual([
      ["Segunda", "08:00 – 18:00"],
      ["Terça", "08:00 – 18:00"],
      ["Quarta", "08:00 – 18:00"],
      ["Quinta", "08:00 – 18:00"],
      ["Sexta", "08:00 – 22:00"],
      ["Sábado", "09:00 – 11:30, 16:00 – 20:00"],
      ["Domingo", "Fechado"],
    ]);
  });

  it.each([0, 3, 6])("marca exatamente um dia como hoje (offset %i)", (offset) => {
    const dias = resumoHorario(SEMANA, em(offset)).dias;

    expect(dias.filter((d) => d.hoje)).toHaveLength(1);
    expect(dias.findIndex((d) => d.hoje)).toBe(offset);
  });
});

describe("resumoHorario › próxima abertura", () => {
  const FIM_DE_SEMANA_FECHADO = { ...SEMANA, sabado: "Fechado", domingo: "Fechado" };

  it("fechado hoje e aberto amanhã → 'amanha'", () => {
    expect(resumoHorario(SEMANA, em(6)).hoje.proximaAbertura).toBe("amanha");
  });

  it("fechado hoje e amanhã → o próximo dia aberto, pulando os fechados", () => {
    expect(resumoHorario(FIM_DE_SEMANA_FECHADO, em(5)).hoje.proximaAbertura).toBe("segunda");
  });

  it("a busca dá a volta na semana: fechado de segunda a sábado, abre domingo", () => {
    const soDomingo = Object.fromEntries(Object.keys(SEMANA).map((dia) => [dia, "Fechado"]));
    soDomingo.domingo = "10:00 – 14:00";

    expect(resumoHorario(soDomingo, em(0)).hoje.proximaAbertura).toBe("domingo");
  });

  it("nenhum dia aberto na semana → sem próxima abertura", () => {
    const sempreFechado = Object.fromEntries(Object.keys(SEMANA).map((dia) => [dia, "Fechado"]));

    expect(resumoHorario(sempreFechado, em(2)).hoje).toMatchObject({ status: "fechado", proximaAbertura: null });
  });

  it("aberto hoje → sem próxima abertura", () => {
    expect(resumoHorario(SEMANA, SEGUNDA).hoje.proximaAbertura).toBeNull();
  });
});

describe("resumoHorario › jsonb incompleto, vazio ou ausente", () => {
  it.each([
    ["nulo", null],
    ["ausente", undefined],
    ["vazio", {}],
    ["array", ["08:00 – 18:00"]],
    ["string", "08:00 – 18:00"],
  ])("%s: os 7 dias ficam sem horário e hoje é 'desconhecido', sem lançar", (_, horario) => {
    const resumo = resumoHorario(horario, SEGUNDA);

    expect(resumo.hoje).toEqual({ status: "desconhecido", horario: null, proximaAbertura: null });
    expect(resumo.dias.map((d) => d.label)).toHaveLength(7);
    expect(resumo.dias.every((d) => d.horario === null)).toBe(true);
  });

  it.each([
    ["faltando", undefined],
    ["vazio", ""],
    ["só espaços", "   "],
    ["não-string", 42],
  ])("dia %s fica sem horário; os outros seguem intactos", (_, valor) => {
    const resumo = resumoHorario({ ...SEMANA, quarta: valor }, SEGUNDA);

    expect(resumo.dias.map((d) => d.horario)).toEqual([
      "08:00 – 18:00",
      "08:00 – 18:00",
      null,
      "08:00 – 18:00",
      "08:00 – 22:00",
      "09:00 – 11:30, 16:00 – 20:00",
      "Fechado",
    ]);
  });

  it.each(["fechado", "FECHADO", "  Fechado  "])("'%s' conta como fechado, não como horário", (valor) => {
    const resumo = resumoHorario({ ...SEMANA, segunda: valor }, SEGUNDA);

    expect(resumo.hoje).toMatchObject({ status: "fechado", proximaAbertura: "amanha" });
    expect(resumo.dias[0].horario).toBe("Fechado");
  });

  it("hoje sem dado é 'desconhecido', não 'fechado'", () => {
    expect(resumoHorario({ ...SEMANA, segunda: "" }, SEGUNDA).hoje).toEqual({
      status: "desconhecido",
      horario: null,
      proximaAbertura: null,
    });
  });

  it("próxima abertura só conta dia com horário conhecido", () => {
    // Domingo fechado, segunda sem dado, terça aberta.
    const resumo = resumoHorario({ ...SEMANA, segunda: undefined }, em(6));

    expect(resumo.hoje.proximaAbertura).toBe("terca");
  });
});

describe("proximaAberturaLabel", () => {
  it.each([
    ["amanha", "abre amanhã"],
    ["terca", "abre terça"],
    ["sabado", "abre sábado"],
    ["domingo", "abre domingo"],
  ] as const)("%s → %s", (proxima, label) => {
    expect(proximaAberturaLabel(proxima)).toBe(label);
  });
});

describe("resumoHorario › seed real", () => {
  const seed: Cafe[] = JSON.parse(
    readFileSync(new URL("../../supabase/seed/cafes.json", import.meta.url), "utf8"),
  );

  it.each(seed.filter((c) => c.ativo).map((c) => [c.slug, c.horario_funcionamento]))(
    "%s tem os 7 dias informados e abre em algum dia",
    (_, horario) => {
      const { dias } = resumoHorario(horario, SEGUNDA);

      expect(dias.every((d) => d.horario !== null)).toBe(true);
      expect(dias.some((d) => d.horario !== "Fechado")).toBe(true);
    },
  );
});
