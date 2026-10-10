import type { StatusNoAdmin } from "@/lib/festival-dados";

import { ETIQUETA } from "./status-cafe";

const COR: Record<StatusNoAdmin, string> = {
  rascunho: "bg-hover-soft text-ink-2",
  futura: "bg-seal-bg text-seal-fg",
  ativa: "bg-open/10 text-open",
  encerrada: "bg-hover-soft text-ink-3",
};

/** Etiqueta da edição no admin: "Rascunho", "Publicada · começa em 18 out", "No ar", "Encerrada". */
export function StatusEdicao({ status, rotulo }: { status: StatusNoAdmin; rotulo: string }) {
  return (
    <span className={`${ETIQUETA} ${COR[status]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {rotulo}
    </span>
  );
}
