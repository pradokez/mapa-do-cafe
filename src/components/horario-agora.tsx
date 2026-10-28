import { CARD_HORARIO } from "@/components/medidas";
import { estadoAgora, rotuloDoCard, type RotuloDoCard } from "@/lib/cafe-hours";

const TOM: Record<RotuloDoCard["tom"], string> = {
  aberto: "font-semibold text-open",
  alerta: "font-semibold text-terracotta",
  fechado: "font-medium text-ink-3",
};

/**
 * Linha "Aberto até 18h" / "Fecha em 20 min" / "Abre às 14h" do card e do
 * preview do mapa (#163), com o ponto de cor do design: cheio quando aberto,
 * vazado quando fechado — a cor nunca é a única pista, o texto diz o estado.
 * Sem informação hoje, a linha fica reservada e vazia: a altura do card não
 * muda. `compacto`: sempre no tamanho do mobile (o preview).
 */
export function HorarioAgora({ horario, agora, compacto = false }: { horario: unknown; agora: Date; compacto?: boolean }) {
  const rotulo = rotuloDoCard(estadoAgora(horario, agora));
  const linha = compacto ? "flex h-4 items-center gap-1.5 text-[12.5px] leading-4" : CARD_HORARIO;

  if (!rotulo) return <span data-horario aria-hidden="true" className={linha} />;
  return (
    <span data-horario className={`${linha} ${TOM[rotulo.tom]}`}>
      <span
        aria-hidden="true"
        className={`size-1.5 flex-none rounded-full ${compacto ? "" : "lg:size-[7px]"} ${rotulo.tom === "fechado" ? "border-[1.5px] border-current" : "bg-current"}`}
      />
      {rotulo.texto}
    </span>
  );
}
