import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

// Id inexistente ou malformado em /admin/cafes/[id].
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Café não encontrado</h1>
      <p className="text-[14.5px] text-ink-2">Esse endereço não corresponde a nenhum café do diretório.</p>
      <Link
        href="/admin"
        className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-terracotta hover:underline"
      >
        <ArrowLeftIcon size={14} strokeWidth={2} />
        Todos os cafés
      </Link>
    </div>
  );
}
