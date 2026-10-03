import { ListIcon, MapIcon } from "@/components/icons";

type Props = {
  view: "lista" | "mapa";
  onToggle: () => void;
};

/** FAB do mobile (50 px): alterna lista ↔ mapa em tela cheia. Não existe a partir de `lg`. */
export function MapFab({ view, onToggle }: Props) {
  const Icon = view === "lista" ? MapIcon : ListIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed bottom-[26px] right-[18px] z-30 inline-flex h-[50px] items-center gap-[9px] rounded-full bg-espresso pl-[17px] pr-5 text-[14.5px] font-semibold text-cream shadow-[0_12px_28px_-8px_rgba(44,26,14,.6)] lg:hidden"
    >
      <Icon size={18} strokeWidth={2} />
      {view === "lista" ? "Ver mapa" : "Ver lista"}
    </button>
  );
}
