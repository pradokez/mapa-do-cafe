import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { rotuloDeNovas } from "@/lib/sugestao";

const CARTAO = "mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 text-[14px]";

/**
 * Topo do `/admin` (#84, design 3a): quantas sugestões novas há, com link para
 * a lista. Sem novas, o cartão não some — fica tracejado, com "Ver todas".
 */
export function CartaoSugestoes({ novas }: { novas: number }) {
  if (novas === 0) {
    return (
      <Link
        href="/admin/sugestoes"
        className={`${CARTAO} border border-dashed border-line-strong text-ink-3 transition-colors hover:border-price-off`}
      >
        Nenhuma sugestão nova
        <span className="ml-auto text-[13px] font-medium text-espresso">Ver todas</span>
      </Link>
    );
  }

  return (
    <Link
      href="/admin/sugestoes"
      className={`${CARTAO} border border-line bg-white text-espresso transition-colors hover:border-price-off`}
    >
      <span aria-hidden="true" className="size-2.5 flex-none rounded-full bg-terracotta" />
      <span className="flex-1">
        <strong className="font-semibold">{rotuloDeNovas(novas)}</strong> <span className="text-ink-3">para ler</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium">
        Ver sugestões
        <ChevronRightIcon size={14} strokeWidth={2} />
      </span>
    </Link>
  );
}
