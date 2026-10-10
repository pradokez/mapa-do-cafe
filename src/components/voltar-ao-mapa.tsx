import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

/**
 * Início da trilha do detalhe; também no skeleton, para voltar sem esperar o
 * café, e na faixa do festival — que troca peso e cor por `className`.
 */
export function VoltarAoMapa({ className = "font-semibold text-espresso" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex flex-none items-center gap-1.5 ${className}`}>
      <ArrowLeftIcon size={15} strokeWidth={2} />
      Voltar ao mapa
    </Link>
  );
}
