import { alternarStatus, STATUS_SUGESTAO, type ContagemDeSugestoes, type StatusSugestao } from "@/lib/sugestao";

const ROTULO_DO_CHIP: Record<StatusSugestao, string> = { nova: "Novas", lida: "Lidas", arquivada: "Arquivadas" };

/**
 * Chips "Novas · Lidas · Arquivadas" de `/admin/sugestoes` (#84, design 3b).
 * Um `<form method="get">`: cada botão envia o filtro que resulta de clicá-lo
 * (`?status=nova,lida,arquivada`), e a página segue Server Component e
 * funcionando sem JS. O último chip ligado não desliga: envia o filtro atual.
 */
export function FiltroDeStatus({ ativos, contagem }: { ativos: StatusSugestao[]; contagem: ContagemDeSugestoes }) {
  return (
    <form method="get" action="/admin/sugestoes" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
      {STATUS_SUGESTAO.map((status) => {
        const ligado = ativos.includes(status);
        const travado = ligado && ativos.length === 1;
        return (
          <button
            key={status}
            type="submit"
            name="status"
            value={alternarStatus(ativos, status).join(",")}
            aria-pressed={ligado}
            aria-disabled={travado || undefined}
            className={`inline-flex h-9 items-center gap-[7px] rounded-full border px-3.5 text-[13px] font-medium transition-colors aria-disabled:cursor-default ${
              ligado ? "border-espresso bg-espresso text-cream" : "border-line-strong bg-white text-espresso hover:bg-hover-soft"
            }`}
          >
            {ROTULO_DO_CHIP[status]}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold ${
                ligado ? "bg-cream/20 text-cream" : "bg-hover-soft text-ink-2"
              }`}
            >
              {contagem[status].toLocaleString("pt-BR")}
            </span>
          </button>
        );
      })}
    </form>
  );
}
