import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

/** Volta à lista do admin, no topo das páginas de um café (detalhe e cadastro). */
export function VoltarAoPainel() {
  return (
    <Link
      href="/admin"
      className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 hover:text-espresso"
    >
      <ArrowLeftIcon size={14} strokeWidth={2} />
      Todos os cafés
    </Link>
  );
}
