/**
 * Spinner do design: anel de 2 px com o topo na cor de frente, girando em
 * .8 s; parado com `prefers-reduced-motion`. As cores e o tamanho vêm de
 * quem usa (a pílula do mapa, o chip "Distância" tentando de novo).
 */
export function Spinner({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      data-spinner=""
      className={`flex-none rounded-full border-2 motion-safe:animate-[spin_0.8s_linear_infinite] ${className}`}
    />
  );
}
