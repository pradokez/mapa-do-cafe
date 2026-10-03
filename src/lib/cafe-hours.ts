import type { DiaSemana } from "./cafe";

/**
 * Horário de funcionamento — PRD › "Horário de funcionamento".
 *
 * Compara só o *dia* ("Aberto hoje"), nunca a hora ("Aberto agora" é Fase 3).
 * O dia é o de Recife: o servidor roda em UTC e, das 21h à meia-noite, já
 * estaria no dia seguinte.
 */

export const FECHADO = "Fechado";

/** Ordem de exibição. Nunca vem de `Object.keys`: o jsonb não preserva ordem. */
const ORDEM: readonly DiaSemana[] = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

const LABEL: Record<DiaSemana, string> = {
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
  const dias = horarioDaSemana(horario).map((d, i) => ({ ...d, label: LABEL[d.dia], hoje: i === iHoje }));

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
  return ORDEM.map((dia) => ({ dia, horario: valorDoDia(registro[dia]) }));
}

function proximaAbertura(dias: DiaHorario[], iHoje: number): "amanha" | DiaSemana | null {
  for (let passo = 1; passo < 7; passo++) {
    const { dia, horario } = dias[(iHoje + passo) % 7];
    if (horario !== null && horario !== FECHADO) return passo === 1 ? "amanha" : dia;
  }
  return null;
}

function isRegistro(value: unknown): value is Record<string, unknown> {
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
  return `abre ${LABEL[proxima].toLocaleLowerCase("pt-BR")}`;
}

/**
 * Horário do jsonb no formato do design: "08:00 – 18:00" → "8h – 18h",
 * "08:30" → "8h30", turno a turno. O resto do texto (e "Fechado") passa intacto.
 */
export function formatarHorario(horario: string): string {
  return horario.replace(/\b(\d{2}):(\d{2})\b/g, (_, h: string, m: string) => `${Number(h)}h${m === "00" ? "" : m}`);
}
