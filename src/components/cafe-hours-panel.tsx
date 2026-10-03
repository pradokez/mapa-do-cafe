import { ChevronDownIcon, ClockIcon } from "@/components/icons";
import { proximaAberturaLabel, type ResumoHorario } from "@/lib/cafe-hours";

/**
 * "Horário de funcionamento": status de hoje no cabeçalho e os 7 dias ao
 * expandir. `<details>` nativo — teclado e ARIA de graça, sem JS.
 */
export function CafeHoursPanel({ resumo }: { resumo: ResumoHorario }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <ClockIcon size={18} strokeWidth={2} className="flex-none" />
        <span className="flex min-w-0 flex-1 flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold">Horário de funcionamento</h2>
          <StatusHoje hoje={resumo.hoje} />
        </span>
        <ChevronDownIcon
          size={18}
          strokeWidth={2}
          className="flex-none transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul className="flex flex-col pb-2.5 pl-[30px] pt-1">
        {resumo.dias.map(({ dia, label, horario, hoje }) => (
          <li
            key={dia}
            aria-current={hoje ? "date" : undefined}
            className={`flex justify-between gap-4 border-b border-dashed border-[#E8DED1] py-2 text-[14.5px] ${
              hoje ? "font-semibold text-espresso" : "text-ink-2"
            }`}
          >
            <span>{label}</span>
            <span className="text-right">{horario ?? "Não informado"}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusHoje({ hoje }: { hoje: ResumoHorario["hoje"] }) {
  if (hoje.status === "desconhecido") return null;

  const complemento =
    hoje.status === "aberto"
      ? hoje.horario
      : hoje.proximaAbertura && proximaAberturaLabel(hoje.proximaAbertura);

  return (
    <span className="text-sm text-ink-2 sm:ml-auto">
      {hoje.status === "aberto" ? (
        <span className="font-semibold text-open">Aberto hoje</span>
      ) : (
        <span className="font-semibold text-terracotta">Fechado hoje</span>
      )}
      {complemento && ` · ${complemento}`}
    </span>
  );
}
