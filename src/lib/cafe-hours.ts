import type { DiaSemana } from "./cafe";

/**
 * Horário de funcionamento — PRD › "Horário de funcionamento".
 *
 * Compara só o *dia* ("Aberto hoje"), nunca a hora ("Aberto agora" é Fase 3a).
 * O dia é o de Recife: o servidor roda em UTC e, das 21h à meia-noite, já
 * estaria no dia seguinte.
 */

export const FECHADO = "Fechado";

/** Ordem de exibição. Nunca vem de `Object.keys`: o jsonb não preserva ordem. */
export const DIAS_DA_SEMANA: readonly DiaSemana[] = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export const NOME_DO_DIA: Record<DiaSemana, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

// Abreviação em inglês (estável entre runtimes) → índice com Segunda = 0.
const INDICE_WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const weekdayEmRecife = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "America/Recife",
});

// Dia da semana e hora de Recife, juntos: os dois precisam vir do mesmo relógio.
const relogioEmRecife = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Recife",
});

const DIA_EM_MINUTOS = 24 * 60;
const TURNO = /^(\d{2}):(\d{2}) – (\d{2}):(\d{2})$/;

/** "Fecha em N min" só a partir de 30 minutos do fechamento. */
export const ALERTA_DE_FECHAMENTO_MIN = 30;

/** Fim do turno atual: uma hora "HH:MM", a meia-noite (`00:00`/`24:00`) ou o dia inteiro. */
export type Fechamento = { hora: string } | "meia-noite" | "24h";

/** Quando o café abre de novo: hoje, amanhã ou um dia da semana, e a hora "HH:MM". */
export type ProximaAbertura = { quando: "hoje" | "amanha" | DiaSemana; hora: string };

export type EstadoAgora =
  /** `faltamMin`: minutos até o fechamento; `null` no café 24 horas. */
  | { estado: "aberto"; fecha: Fechamento; faltamMin: number | null }
  /** `abre`: `null` quando nenhum dia da semana abre. */
  | { estado: "fechado"; abre: ProximaAbertura | null }
  | { estado: "sem-informacao" };

type TurnoEmMinutos = { abre: number; fecha: number; horaAbre: string; horaFecha: string };

/**
 * `(jsonb de horário, instante)` → aberto agora (até quando), fechado (quando
 * abre) ou sem informação para hoje — no relógio de Recife. A abertura conta
 * (às 8:00 em ponto, quem abre às 8h está aberto) e o fechamento não. Nenhum
 * turno atravessa a meia-noite (`14:00 – 00:00` vai até 23:59), então ontem
 * nunca vale hoje — nem amanhã estende hoje.
 */
export function estadoAgora(horario: unknown, agora: Date): EstadoAgora {
  const partes = Object.fromEntries(relogioEmRecife.formatToParts(agora).map((p) => [p.type, p.value]));
  const iHoje = INDICE_WEEKDAY[partes.weekday];
  const minuto = Number(partes.hour) * 60 + Number(partes.minute);
  const semana = horarioDaSemana(horario).map(({ horario }) => turnosDoDia(horario));

  const hoje = semana[iHoje];
  if (hoje === null) return { estado: "sem-informacao" };

  const atual = hoje.find((t) => t.abre <= minuto && minuto < t.fecha);
  if (atual) {
    if (atual.abre === 0 && atual.fecha === DIA_EM_MINUTOS) return { estado: "aberto", fecha: "24h", faltamMin: null };
    return {
      estado: "aberto",
      fecha: atual.fecha === DIA_EM_MINUTOS ? "meia-noite" : { hora: atual.horaFecha },
      faltamMin: atual.fecha - minuto,
    };
  }

  const maisTarde = hoje.find((t) => t.abre > minuto);
  if (maisTarde) return { estado: "fechado", abre: { quando: "hoje", hora: maisTarde.horaAbre } };

  // Até 7 passos: o próprio dia da semana que vem também conta.
  for (let passo = 1; passo <= 7; passo++) {
    const i = (iHoje + passo) % 7;
    const [primeiro] = semana[i] ?? [];
    if (primeiro) {
      return { estado: "fechado", abre: { quando: passo === 1 ? "amanha" : DIAS_DA_SEMANA[i], hora: primeiro.horaAbre } };
    }
  }
  return { estado: "fechado", abre: null };
}

/** Texto do dia → turnos em minutos (`[]` = "Fechado"), ou `null` se não informado ou fora do formato. */
function turnosDoDia(horario: string | null): TurnoEmMinutos[] | null {
  if (horario === null) return null;
  if (horario === FECHADO) return [];
  const turnos: TurnoEmMinutos[] = [];
  for (const texto of horario.split(", ")) {
    const [, ha, ma, hf, mf] = TURNO.exec(texto) ?? [];
    if (ha === undefined) return null;
    const abre = Number(ha) * 60 + Number(ma);
    // Fechar às 00:00 ou às 24:00 é fechar à meia-noite.
    const fecha = Number(hf) * 60 + Number(mf) || DIA_EM_MINUTOS;
    turnos.push({ abre, fecha, horaAbre: `${ha}:${ma}`, horaFecha: `${hf}:${mf}` });
  }
  return turnos;
}

export interface RotuloDoDetalhe {
  /** Em negrito, `open` quando aberto e `terracotta` quando fechado. */
  estado: "Aberto agora" | "Fechado agora" | "Fechado";
  complemento: string | null;
  /** "fecha em N min": o complemento também em terracota. */
  alerta: boolean;
}

/** Badge do cabeçalho de "Horário de funcionamento" no detalhe; `null` = sem badge. */
export function rotuloDoDetalhe(agora: EstadoAgora): RotuloDoDetalhe | null {
  switch (agora.estado) {
    case "sem-informacao":
      return null;
    case "aberto": {
      const alerta = agora.faltamMin !== null && agora.faltamMin <= ALERTA_DE_FECHAMENTO_MIN;
      const complemento = alerta
        ? `fecha em ${agora.faltamMin} min`
        : agora.fecha === "24h"
          ? "24 horas"
          : agora.fecha === "meia-noite"
            ? "fecha à meia-noite"
            : `fecha às ${formatarHorario(agora.fecha.hora)}`;
      return { estado: "Aberto agora", complemento, alerta };
    }
    case "fechado": {
      if (agora.abre === null) return { estado: "Fechado", complemento: null, alerta: false };
      const { quando, hora } = agora.abre;
      const dia = quando === "hoje" ? "" : quando === "amanha" ? " amanhã" : ` ${NOME_DO_DIA[quando].toLocaleLowerCase("pt-BR")}`;
      const as = hora === "00:00" ? "à meia-noite" : `às ${formatarHorario(hora)}`;
      return { estado: "Fechado agora", complemento: `abre${dia} ${as}`, alerta: false };
    }
  }
}

export interface DiaHorario {
  dia: DiaSemana;
  /** "Segunda", "Terça", … */
  label: string;
  /** "HH:MM – HH:MM" (turnos por ", "), "Fechado", ou `null` quando não informado. */
  horario: string | null;
  hoje: boolean;
}

export type StatusHoje =
  | { status: "aberto"; horario: string; proximaAbertura: null }
  /** `proximaAbertura`: "amanha", o próximo dia aberto, ou `null` se nenhum abre. */
  | { status: "fechado"; horario: null; proximaAbertura: "amanha" | DiaSemana | null }
  | { status: "desconhecido"; horario: null; proximaAbertura: null };

export interface ResumoHorario {
  hoje: StatusHoje;
  /** Sempre os 7 dias, de Segunda a Domingo. */
  dias: DiaHorario[];
}

/**
 * `(jsonb de horário, data)` → status de hoje e os 7 dias com hoje marcado.
 * Dado ausente ou malformado nunca lança: o dia vira "não informado".
 */
export function resumoHorario(horario: unknown, data: Date): ResumoHorario {
  const iHoje = INDICE_WEEKDAY[weekdayEmRecife.format(data)];
  const dias = horarioDaSemana(horario).map((d, i) => ({ ...d, label: NOME_DO_DIA[d.dia], hoje: i === iHoje }));

  const valor = dias[iHoje].horario;
  const hoje: StatusHoje =
    valor === null
      ? { status: "desconhecido", horario: null, proximaAbertura: null }
      : valor === FECHADO
        ? { status: "fechado", horario: null, proximaAbertura: proximaAbertura(dias, iHoje) }
        : { status: "aberto", horario: valor, proximaAbertura: null };

  return { hoje, dias };
}

/**
 * Os 7 dias, de Segunda a Domingo, com o texto de cada um normalizado:
 * "HH:MM – HH:MM" (turnos por ", "), `"Fechado"`, ou `null` quando não informado.
 */
export function horarioDaSemana(horario: unknown): { dia: DiaSemana; horario: string | null }[] {
  const registro = isRegistro(horario) ? horario : {};
  return DIAS_DA_SEMANA.map((dia) => ({ dia, horario: valorDoDia(registro[dia]) }));
}

function proximaAbertura(dias: DiaHorario[], iHoje: number): "amanha" | DiaSemana | null {
  for (let passo = 1; passo < 7; passo++) {
    const { dia, horario } = dias[(iHoje + passo) % 7];
    if (horario !== null && horario !== FECHADO) return passo === 1 ? "amanha" : dia;
  }
  return null;
}

export function isRegistro(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texto do dia sem espaços nas pontas; "fechado" em qualquer caixa vira `FECHADO`. */
function valorDoDia(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const valor = value.trim();
  return valor.toLocaleLowerCase("pt-BR") === FECHADO.toLocaleLowerCase("pt-BR") ? FECHADO : valor;
}

/** Complemento de "Fechado hoje": "abre amanhã" (microcopy fixado) ou "abre sábado". */
export function proximaAberturaLabel(proxima: "amanha" | DiaSemana): string {
  if (proxima === "amanha") return "abre amanhã";
  return `abre ${NOME_DO_DIA[proxima].toLocaleLowerCase("pt-BR")}`;
}

/**
 * Horário do jsonb no formato do design: "08:00 – 18:00" → "8h – 18h",
 * "08:30" → "8h30", turno a turno. O resto do texto (e "Fechado") passa intacto.
 */
export function formatarHorario(horario: string): string {
  return horario.replace(/\b(\d{2}):(\d{2})\b/g, (_, h: string, m: string) => `${Number(h)}h${m === "00" ? "" : m}`);
}
