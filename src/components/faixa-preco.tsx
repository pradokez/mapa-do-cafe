import type { FaixaPreco } from "@/lib/cafe";

/** "$$" ativos + "$" apagados até três. Visual só: o rótulo fica com quem usa. */
export function FaixaPrecoSimbolos({ faixa }: { faixa: FaixaPreco }) {
  return (
    <span aria-hidden="true">
      {faixa}
      <span className="text-price-off">{"$".repeat(3 - faixa.length)}</span>
    </span>
  );
}
