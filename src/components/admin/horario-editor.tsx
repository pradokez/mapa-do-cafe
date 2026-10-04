"use client";

// Client: turnos que entram e saem, "Fechado" e "Repetir nos dias seguintes".
import type { DiaSemana } from "@/lib/cafe";
import type { HorarioDia } from "@/lib/cafe-dados";
import { DIAS_DA_SEMANA, NOME_DO_DIA } from "@/lib/cafe-hours";
import { XIcon } from "@/components/icons";

import { Erro } from "./form";

export type Horario = Record<DiaSemana, HorarioDia>;

const MAX_TURNOS = 3;
const TURNO_VAZIO = { abre: "", fecha: "" };

const timeClass =
  "h-11 w-[136px] rounded-lg border border-line-strong bg-white px-3 text-[16px] tabular-nums text-espresso aria-[invalid=true]:border-terracotta";
const botaoLinkClass =
  "min-h-11 rounded-full px-3 text-[13.5px] font-semibold text-ink-2 hover:bg-hover-soft hover:text-espresso";

type Props = {
  horario: Horario;
  erros: Partial<Record<DiaSemana, string>>;
  onChange: (dia: DiaSemana, valor: HorarioDia) => void;
  /** Copia o horário da Segunda para os outros seis dias. */
  onRepetir: () => void;
};

/** Horário dos 7 dias, de Segunda a Domingo: "Fechado" ou de 1 a 3 turnos. */
export function HorarioEditor({ horario, erros, onChange, onRepetir }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {DIAS_DA_SEMANA.map((dia) => {
        const { fechado, turnos } = horario[dia];
        const nome = NOME_DO_DIA[dia];
        const erro = erros[dia];
        const idErro = `erro-horario-${dia}`;
        const mudar = (valor: Partial<HorarioDia>) => onChange(dia, { ...horario[dia], ...valor });

        return (
          <li key={dia} className="py-3 first:pt-0 last:pb-0">
            <fieldset aria-describedby={erro ? idErro : undefined}>
              {/* `legend` não entra em flex/grid: a do leitor de tela fica oculta, a visível é um span. */}
              <legend className="sr-only">{nome}</legend>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                <span aria-hidden className="w-24 shrink-0 pt-2.5 text-[14.5px] font-semibold text-espresso">
                  {nome}
                </span>

                <div className="flex flex-1 flex-col gap-1">
                  {/* Turnos, "Fechado" e "+ turno" na mesma linha: a semana cabe sem rolar tanto. */}
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    {!fechado && (
                      <ol className="flex flex-col gap-2">
                        {turnos.map((turno, i) => {
                          const rotulo = turnos.length > 1 ? `${nome}, turno ${i + 1}` : nome;
                          const mudarTurno = (campo: "abre" | "fecha", valor: string) =>
                            mudar({ turnos: turnos.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) });
                          const campo = (lado: "abre" | "fecha") => (
                            <input
                              type="time"
                              aria-label={`${rotulo}: ${lado}`}
                              value={turno[lado]}
                              onChange={(e) => mudarTurno(lado, e.target.value)}
                              aria-invalid={erro ? true : undefined}
                              aria-describedby={erro ? idErro : undefined}
                              className={timeClass}
                            />
                          );
                          return (
                            <li key={i} className="flex items-center gap-2">
                              {campo("abre")}
                              <span aria-hidden className="text-ink-3">
                                –
                              </span>
                              {campo("fecha")}
                              {turnos.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Remover ${rotulo.toLocaleLowerCase("pt-BR")}`}
                                  onClick={() => mudar({ turnos: turnos.filter((_, j) => j !== i) })}
                                  className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-hover-soft hover:text-espresso"
                                >
                                  <XIcon size={16} strokeWidth={2} />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14.5px] text-espresso">
                      <input
                        type="checkbox"
                        checked={fechado}
                        onChange={(e) => mudar({ fechado: e.target.checked })}
                        className="size-[18px] accent-terracotta"
                      />
                      Fechado
                    </label>
                    {!fechado && turnos.length < MAX_TURNOS && (
                      <button
                        type="button"
                        aria-label={`Adicionar turno na ${nome.toLocaleLowerCase("pt-BR")}`}
                        onClick={() => mudar({ turnos: [...turnos, { ...TURNO_VAZIO }] })}
                        className={botaoLinkClass}
                      >
                        + turno
                      </button>
                    )}
                  </div>
                  {dia === "segunda" && (
                    <button type="button" onClick={onRepetir} className={`${botaoLinkClass} -ml-3 self-start`}>
                      Repetir nos dias seguintes
                    </button>
                  )}
                  <Erro id={idErro} erro={erro} />
                </div>
              </div>
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}
