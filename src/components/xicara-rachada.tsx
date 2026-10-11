/**
 * Xícara rachada em line art, da falha ao carregar (PRD #135): o traço da
 * `EmptyCupIllustration`, sem o vapor, com a rachadura em terracota.
 * Decorativa: o título ao lado diz o mesmo. Tamanho pela `className`.
 */
export function XicaraRachada({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 116"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="64" cy="46" rx="30" ry="5" />
      <path d="M34 46v20c0 16 13 28 30 28s30-12 30-28V46" />
      <path d="M94 54h6a10 10 0 0 1 0 20h-8" />
      <path d="M60 52l6 10-5 8 4 10" className="text-terracotta" />
      <path d="M16 102h96" />
    </svg>
  );
}
