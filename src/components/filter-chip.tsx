/** Pílula de filtro do design (36 px no mobile, 38 px no desktop), compartilhada pelos chips e pelo gatilho do bairro. */
const CHIP =
  "inline-flex h-9 flex-none items-center rounded-full border text-[13px] transition-colors duration-200 motion-reduce:transition-none lg:h-[38px] lg:text-[13.5px]";
const CHIP_ON = "border-terracotta bg-terracotta text-on-terracotta hover:border-terracotta-hover hover:bg-terracotta-hover";
const CHIP_OFF = "border-chip-line text-espresso hover:bg-hover-soft";

export function chipClass(ativo: boolean, extra: string): string {
  return `${CHIP} ${ativo ? CHIP_ON : CHIP_OFF} ${extra}`;
}

type AtributoChipProps = {
  opcao: { label: string; curto: string; Icon: (props: { size?: number; strokeWidth?: number; className?: string }) => React.ReactNode };
  ativo: boolean;
  onToggle: () => void;
};

/**
 * Chip de um filtro booleano (selo ou comodidade), da barra e do sheet de
 * filtros: rótulo curto no mobile, inteiro no desktop; o nome acessível é
 * sempre o inteiro, que contém o curto visível.
 */
export function AtributoChip({ opcao: { label, curto, Icon }, ativo, onToggle }: AtributoChipProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={ativo}
      onClick={onToggle}
      className={chipClass(ativo, "gap-1.5 px-[13px] font-medium lg:gap-2 lg:px-[15px]")}
    >
      <Icon size={16} strokeWidth={2} className="max-lg:size-[15px]" />
      <span className="lg:hidden">{curto}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
