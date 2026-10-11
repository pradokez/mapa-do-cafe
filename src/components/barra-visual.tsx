/**
 * A barra de progresso do topo (#137): trilho `terracotta/15` de 3 px e um
 * trecho de 35% que corre (parado com `prefers-reduced-motion`). Módulo
 * neutro, sem `"use client"`: o skeleton a desenha sem JS, e o
 * `BarraDeProgresso` a liga nos cliques. Fora da árvore de acessibilidade —
 * quem anuncia o carregamento é o `CarregandoStatus`.
 *
 * `origem` marca quem desenhou: com a do skeleton na tela, a da navegação se
 * esconde (`globals.css`), para não haver duas barras sobrepostas.
 */
export function BarraVisual({ origem }: { origem: "navegacao" | "carregamento" }) {
  return (
    <div
      aria-hidden="true"
      data-barra={origem}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-terracotta/15"
    >
      <div className="h-full w-[35%] bg-terracotta motion-safe:animate-barra" />
    </div>
  );
}
