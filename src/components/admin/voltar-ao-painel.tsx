import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

/** Volta a uma lista do admin, no topo das páginas de detalhe e cadastro (cafés, por padrão; festivais). */
export function VoltarAoPainel({ href = "/admin", rotulo = "Todos os cafés" }: { href?: string; rotulo?: string }) {
  return (
    <Link
      href={href}
      className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 hover:text-espresso"
    >
      <ArrowLeftIcon size={14} strokeWidth={2} />
      {rotulo}
    </Link>
  );
}
