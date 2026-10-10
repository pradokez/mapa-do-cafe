import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";

// Id inexistente ou malformado em /admin/festivais/[id].
export default function EdicaoNaoEncontrada() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Edição não encontrada</h1>
      <p className="mb-2 text-[14.5px] text-ink-2">Esse endereço não corresponde a nenhuma edição de festival.</p>
      <VoltarAoPainel href="/admin/festivais" rotulo="Todos os festivais" />
    </div>
  );
}
