import { ChevronDownIcon, ClockIcon } from "@/components/icons";
import { formatarHorario, rotuloDoDetalhe, type DiaHorario, type EstadoAgora } from "@/lib/cafe-hours";

/**
 * "Horário de funcionamento": o estado de agora no cabeçalho e os 7 dias ao
 * expandir. `<details>` nativo — teclado e ARIA de graça, sem JS.
 */
export function CafeHoursPanel({ dias, agora }: { dias: DiaHorario[]; agora: EstadoAgora }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <ClockIcon size={18} strokeWidth={2} className="flex-none" />
        <span className="flex min-w-0 flex-1 flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold">Horário de funcionamento</h2>
          <StatusAgora agora={agora} />
        </span>
        <ChevronDownIcon
          size={18}
          strokeWidth={2}
          className="flex-none transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul className="flex flex-col pb-2.5 pl-[30px] pt-1">
        {dias.map(({ dia, label, horario, hoje }) => (
          <li
            key={dia}
            aria-current={hoje ? "date" : undefined}
            className={`flex justify-between gap-4 border-b border-dashed border-[#E8DED1] py-2 text-[14.5px] ${
              hoje ? "font-semibold text-espresso" : "text-ink-2"
            }`}
          >
            <span>{label}</span>
            <span className="text-right">{horario === null ? "Não informado" : formatarHorario(horario)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusAgora({ agora }: { agora: EstadoAgora }) {
  const rotulo = rotuloDoDetalhe(agora);
  if (!rotulo) return null;

  return (
    <span className="text-sm text-ink-2 sm:ml-auto">
      <span className={`font-semibold ${rotulo.estado === "Aberto agora" ? "text-open" : "text-terracotta"}`}>
        {rotulo.estado}
      </span>
      {rotulo.complemento && (
        <>
          {" · "}
          <span className={rotulo.alerta ? "font-semibold text-terracotta" : undefined}>{rotulo.complemento}</span>
        </>
      )}
    </span>
  );
}
