import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe, DiaSemana } from "./cafe";

import { estadoAgora, formatarHorario, proximaAberturaLabel, resumoHorario, rotuloDoDetalhe } from "./cafe-hours";

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

  it.each(seed.filter((c) => c.ativo).map((c) => [c.slug, c.horario_funcionamento]))(
    "%s tem estado de agora em todo dia (nenhum texto fora do formato)",
    (_, horario) => {
      for (let dia = 0; dia < 7; dia++) {
        expect(estadoAgora(horario, recife(dia, "12:00")).estado).not.toBe("sem-informacao");
      }
    },
  );
});

// Hora local de Recife (UTC−3, sem horário de verão) → instante. `dia` 0 = segunda 05/10/2026.
const recife = (dia: number, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 5 + dia, h + 3, m));
};

const todosOsDias = (valor: string) =>
  Object.fromEntries(Object.keys(SEMANA).map((dia) => [dia, valor])) as Record<DiaSemana, string>;

describe("estadoAgora › aberto", () => {
  it("no meio do turno: aberto, fecha às 18h, com os minutos que faltam", () => {
    expect(estadoAgora(SEMANA, recife(0, "10:00"))).toEqual({
      estado: "aberto",
      fecha: { hora: "18:00" },
      faltamMin: 480,
    });
  });

  it("no minuto da abertura já está aberto", () => {
    expect(estadoAgora(SEMANA, recife(0, "08:00"))).toMatchObject({ estado: "aberto", faltamMin: 600 });
  });

  it("no minuto do fechamento já está fechado", () => {
    expect(estadoAgora(SEMANA, recife(0, "18:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "amanha", hora: "08:00" },
    });
  });

  it("a 30 e a 31 minutos do fechamento", () => {
    expect(estadoAgora(SEMANA, recife(0, "17:30"))).toMatchObject({ estado: "aberto", faltamMin: 30 });
    expect(estadoAgora(SEMANA, recife(0, "17:29"))).toMatchObject({ estado: "aberto", faltamMin: 31 });
  });

  it("no segundo turno, fecha no fim dele", () => {
    expect(estadoAgora(SEMANA, recife(5, "17:00"))).toMatchObject({ estado: "aberto", fecha: { hora: "20:00" } });
  });

  it("'14:00 – 00:00' às 23:59: aberto, fecha à meia-noite, falta 1 min", () => {
    const tardeENoite = { ...SEMANA, segunda: "14:00 – 00:00" };

    expect(estadoAgora(tardeENoite, recife(0, "23:59"))).toEqual({
      estado: "aberto",
      fecha: "meia-noite",
      faltamMin: 1,
    });
  });

  it("'14:00 – 00:00' à 00:00 do dia seguinte: fechado (ontem não vale hoje)", () => {
    const tardeENoite = { ...SEMANA, segunda: "14:00 – 00:00", terca: "14:00 – 00:00" };

    expect(estadoAgora(tardeENoite, recife(1, "00:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "hoje", hora: "14:00" },
    });
  });

  it.each(["00:00", "03:00", "23:59"])("'00:00 – 24:00' é 24 horas (%s)", (hora) => {
    expect(estadoAgora(todosOsDias("00:00 – 24:00"), recife(2, hora))).toEqual({
      estado: "aberto",
      fecha: "24h",
      faltamMin: null,
    });
  });
});

describe("estadoAgora › fechado", () => {
  it("no intervalo entre turnos: abre hoje no segundo turno", () => {
    expect(estadoAgora(SEMANA, recife(5, "13:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "hoje", hora: "16:00" },
    });
  });

  it("antes do primeiro turno: abre hoje", () => {
    expect(estadoAgora(SEMANA, recife(0, "06:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "hoje", hora: "08:00" },
    });
  });

  it("depois do último turno, com amanhã 'Fechado': abre no próximo dia, pulando os fechados", () => {
    // Sábado 21h; domingo fechado → segunda.
    expect(estadoAgora(SEMANA, recife(5, "21:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "segunda", hora: "08:00" },
    });
  });

  it("domingo → segunda é 'amanhã'", () => {
    expect(estadoAgora(SEMANA, recife(6, "12:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "amanha", hora: "08:00" },
    });
  });

  it("fechado a semana toda: sem próxima abertura", () => {
    expect(estadoAgora(todosOsDias("Fechado"), recife(3, "12:00"))).toEqual({ estado: "fechado", abre: null });
  });

  it("só abre no próprio dia e já fechou: abre no mesmo dia da semana seguinte", () => {
    const soSegunda = { ...todosOsDias("Fechado"), segunda: "08:00 – 12:00" };

    expect(estadoAgora(soSegunda, recife(0, "13:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "segunda", hora: "08:00" },
    });
  });

  it("dia sem informação ou fora do formato é pulado na próxima abertura", () => {
    // Domingo fechado, segunda sem dado, terça inválida, quarta aberta.
    const horario = { ...SEMANA, segunda: undefined, terca: "sob consulta" };

    expect(estadoAgora(horario, recife(6, "12:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "quarta", hora: "08:00" },
    });
  });

  it("abre à meia-noite do dia seguinte", () => {
    const horario = { ...SEMANA, terca: "00:00 – 24:00" };

    expect(estadoAgora(horario, recife(0, "19:00"))).toEqual({
      estado: "fechado",
      abre: { quando: "amanha", hora: "00:00" },
    });
  });
});

describe("estadoAgora › sem informação e fuso", () => {
  it.each([
    ["sem o dia", { ...SEMANA, segunda: undefined }],
    ["vazio", { ...SEMANA, segunda: "" }],
    ["fora do formato", { ...SEMANA, segunda: "sob consulta" }],
    ["jsonb nulo", null],
  ])("hoje %s → sem-informacao", (_, horario) => {
    expect(estadoAgora(horario, recife(0, "10:00"))).toEqual({ estado: "sem-informacao" });
  });

  it("o relógio é o de Recife: sábado 22h30 em Recife já é domingo 01h30 em UTC", () => {
    const horario = { ...SEMANA, sabado: "18:00 – 23:00", domingo: "00:00 – 24:00" };

    expect(estadoAgora(horario, new Date("2026-10-11T01:30:00Z"))).toEqual({
      estado: "aberto",
      fecha: { hora: "23:00" },
      faltamMin: 30,
    });
  });

  it("às 21h de Recife (meia-noite em UTC) ainda é o mesmo dia", () => {
    // Segunda 21h em Recife = terça 00:00Z.
    expect(estadoAgora(SEMANA, new Date("2026-10-06T00:00:00Z"))).toEqual({
      estado: "fechado",
      abre: { quando: "amanha", hora: "08:00" },
    });
  });
});

describe("rotuloDoDetalhe", () => {
  it.each([
    [{ estado: "aberto", fecha: { hora: "18:00" }, faltamMin: 120 }, "Aberto agora", "fecha às 18h", false],
    [{ estado: "aberto", fecha: { hora: "18:30" }, faltamMin: 31 }, "Aberto agora", "fecha às 18h30", false],
    [{ estado: "aberto", fecha: "meia-noite", faltamMin: 90 }, "Aberto agora", "fecha à meia-noite", false],
    [{ estado: "aberto", fecha: "24h", faltamMin: null }, "Aberto agora", "24 horas", false],
    [{ estado: "aberto", fecha: { hora: "18:00" }, faltamMin: 30 }, "Aberto agora", "fecha em 30 min", true],
    [{ estado: "aberto", fecha: "meia-noite", faltamMin: 1 }, "Aberto agora", "fecha em 1 min", true],
    [{ estado: "fechado", abre: { quando: "hoje", hora: "14:00" } }, "Fechado agora", "abre às 14h", false],
    [{ estado: "fechado", abre: { quando: "amanha", hora: "08:00" } }, "Fechado agora", "abre amanhã às 8h", false],
    [{ estado: "fechado", abre: { quando: "segunda", hora: "08:30" } }, "Fechado agora", "abre segunda às 8h30", false],
    [{ estado: "fechado", abre: { quando: "sabado", hora: "09:00" } }, "Fechado agora", "abre sábado às 9h", false],
    [{ estado: "fechado", abre: { quando: "amanha", hora: "00:00" } }, "Fechado agora", "abre amanhã à meia-noite", false],
    [{ estado: "fechado", abre: null }, "Fechado", null, false],
  ] as const)("%j → %s · %s", (estado, rotulo, complemento, alerta) => {
    expect(rotuloDoDetalhe(estado)).toEqual({ estado: rotulo, complemento, alerta });
  });

  it("sem informação → sem badge", () => {
    expect(rotuloDoDetalhe({ estado: "sem-informacao" })).toBeNull();
  });
});

describe("formatarHorario", () => {
  it("exibe hora cheia como no design: '08:00 – 18:00' → '8h – 18h'", () => {
    expect(formatarHorario("08:00 – 18:00")).toBe("8h – 18h");
  });

  it("mantém os minutos quando não é hora cheia, e cada turno: '08:30 – 12:30, 15:00 – 20:00' → '8h30 – 12h30, 15h – 20h'", () => {
    expect(formatarHorario("08:30 – 12:30, 15:00 – 20:00")).toBe("8h30 – 12h30, 15h – 20h");
  });

  it("deixa 'Fechado' e texto fora do formato como estão", () => {
    expect(formatarHorario("Fechado")).toBe("Fechado");
    expect(formatarHorario("sob consulta")).toBe("sob consulta");
  });
});
