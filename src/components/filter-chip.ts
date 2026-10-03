/** Pílula de filtro do design (36 px no mobile, 38 px no desktop), compartilhada pelos chips e pelo gatilho do bairro. */
const CHIP =
  "inline-flex h-9 flex-none items-center rounded-full border text-[13px] transition-colors duration-200 motion-reduce:transition-none lg:h-[38px] lg:text-[13.5px]";
const CHIP_ON = "border-terracotta bg-terracotta text-on-terracotta hover:border-terracotta-hover hover:bg-terracotta-hover";
const CHIP_OFF = "border-chip-line text-espresso hover:bg-hover-soft";

export function chipClass(ativo: boolean, extra: string): string {
  return `${CHIP} ${ativo ? CHIP_ON : CHIP_OFF} ${extra}`;
}
