/**
 * Xícara vazia em line art, do estado vazio da home (design, tela 04).
 * Decorativa: o título ao lado diz o mesmo. Tamanho pela `className`
 * (a proporção vem do viewBox).
 */
export function EmptyCupIllustration({ className }: { className?: string }) {
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
      <g className="text-terracotta" strokeDasharray="2 5">
        <path d="M54 30c-5-6 5-10 0-17" />
        <path d="M66 26c-5-6 5-10 0-17" />
        <path d="M78 30c-5-6 5-10 0-17" />
      </g>
      <ellipse cx="64" cy="46" rx="30" ry="5" />
      <path d="M34 46v20c0 16 13 28 30 28s30-12 30-28V46" />
      <path d="M94 54h6a10 10 0 0 1 0 20h-8" />
      <path d="M16 102h96" />
      <path d="M34 109h60" opacity={0.45} />
    </svg>
  );
}
