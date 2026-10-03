import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

/** Início da trilha do detalhe; também no skeleton, para voltar sem esperar o café. */
export function VoltarAoMapa() {
  return (
    <Link href="/" className="inline-flex flex-none items-center gap-1.5 font-semibold text-espresso">
      <ArrowLeftIcon size={15} strokeWidth={2} />
      Voltar ao mapa
    </Link>
  );
}
