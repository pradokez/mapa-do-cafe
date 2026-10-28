import type { DiaSemana } from "./cafe";

/**
 * Horário de funcionamento — PRD › "Horário de funcionamento".
 *
 * O dia e a hora são os de Recife: o servidor roda em UTC e, das 21h à
 * meia-noite, já estaria no dia seguinte.
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
  const { iHoje, minuto } = emRecife(agora);
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

/** Índice do dia (Segunda = 0) e minutos desde 00:00, no relógio de Recife. */
function emRecife(instante: Date): { iHoje: number; minuto: number } {
  const partes = Object.fromEntries(relogioEmRecife.formatToParts(instante).map((p) => [p.type, p.value]));
  return { iHoje: INDICE_WEEKDAY[partes.weekday], minuto: Number(partes.hour) * 60 + Number(partes.minute) };
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
    // Hora que não existe (25:00, 08:75) é texto fora do formato.
    if (Number(ha) > 23 || Number(ma) > 59 || Number(mf) > 59 || fecha > DIA_EM_MINUTOS) return null;
    turnos.push({ abre, fecha, horaAbre: `${ha}:${ma}`, horaFecha: `${hf}:${mf}` });
  }
  return turnos;
}

/**
 * Ids dos cafés fechados no instante dado: os pins apagados do mapa (#165).
 * Sem informação hoje não entra — não sabemos se está fechado.
 */
export function fechadosAgora(
  cafes: readonly { id: string; horario_funcionamento: unknown }[],
  agora: Date,
): Set<string> {
  return new Set(
    cafes.filter((cafe) => estadoAgora(cafe.horario_funcionamento, agora).estado === "fechado").map((c) => c.id),
  );
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

/**
 * `(jsonb de horário, data)` → os 7 dias, de Segunda a Domingo, com hoje
 * (em Recife) marcado. Dado ausente ou malformado nunca lança: o dia vira
 * "não informado".
 */
export function diasComHoje(horario: unknown, data: Date): DiaHorario[] {
  const { iHoje } = emRecife(data);
  return horarioDaSemana(horario).map((d, i) => ({ ...d, label: NOME_DO_DIA[d.dia], hoje: i === iHoje }));
}

/**
 * Os 7 dias, de Segunda a Domingo, com o texto de cada um normalizado:
 * "HH:MM – HH:MM" (turnos por ", "), `"Fechado"`, ou `null` quando não informado.
 */
export function horarioDaSemana(horario: unknown): { dia: DiaSemana; horario: string | null }[] {
  const registro = isRegistro(horario) ? horario : {};
  return DIAS_DA_SEMANA.map((dia) => ({ dia, horario: valorDoDia(registro[dia]) }));
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

/**
 * Horário do jsonb no formato do design: "08:00 – 18:00" → "8h – 18h",
 * "08:30" → "8h30", turno a turno. O resto do texto (e "Fechado") passa intacto.
 */
export function formatarHorario(horario: string): string {
  return horario.replace(/\b(\d{2}):(\d{2})\b/g, (_, h: string, m: string) => `${Number(h)}h${m === "00" ? "" : m}`);
}
