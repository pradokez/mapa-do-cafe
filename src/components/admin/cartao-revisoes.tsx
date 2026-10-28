import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { formatarUltimaRodada, rotuloDePendentes, type Rodada } from "@/lib/revisao";

const CARTAO = "mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 text-[14px]";

/**
 * Topo do `/admin` (#177), logo abaixo do das sugestões: quantas revisões do
 * robô esperam decisão e quando ele rodou pela última vez. Sem pendentes, o
 * cartão não some (tracejado, "Ver todas"): é como se confere que a rodada aconteceu.
 */
export function CartaoRevisoes({ pendentes, rodada }: { pendentes: number; rodada: Rodada | null }) {
  const quando = rodada ? `Última rodada: ${formatarUltimaRodada(rodada.inicio)}` : "O robô ainda não rodou";

  if (pendentes === 0) {
    return (
      <Link
        href="/admin/revisoes?status=pendente,aprovada,rejeitada,obsoleta"
        className={`${CARTAO} border border-dashed border-line-strong text-ink-3 transition-colors hover:border-price-off`}
      >
        <span className="flex-1">
          Nenhuma revisão pendente <span className="text-[13px]">· {quando}</span>
        </span>
        <span className="text-[13px] font-medium text-espresso">Ver todas</span>
      </Link>
    );
  }

  return (
    <Link
      href="/admin/revisoes"
      className={`${CARTAO} border border-line bg-white text-espresso transition-colors hover:border-price-off`}
    >
      <span aria-hidden="true" className="size-2.5 flex-none rounded-full bg-terracotta" />
      <span className="flex-1">
        <strong className="font-semibold">{rotuloDePendentes(pendentes)}</strong>{" "}
        <span className="text-ink-3">· {quando}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium">
        Ver revisões
        <ChevronRightIcon size={14} strokeWidth={2} />
      </span>
    </Link>
  );
}
