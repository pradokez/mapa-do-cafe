/** Etiqueta "No ar" / "Fora do ar" do admin. */
export function StatusCafe({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-open/10 px-2.5 py-0.5 text-[12.5px] font-semibold text-open">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-open" />
      No ar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-seal-bg px-2.5 py-0.5 text-[12.5px] font-semibold text-seal-fg">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-seal-fg" />
      Fora do ar
    </span>
  );
}

/**
 * Link para o café no site público — só para café ativo (o inativo dá 404 lá).
 * Nova aba, sem `opener` nem `referrer` saindo do admin.
 */
export function VerNoSite({ slug, ativo }: { slug: string; ativo: boolean }) {
  if (!ativo) {
    return <span className="whitespace-nowrap text-[13px] text-ink-3">não aparece no site</span>;
  }
  return (
    <a
      href={`/cafes/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whitespace-nowrap text-[13.5px] font-semibold text-terracotta underline-offset-2 hover:underline"
    >
      Ver no site <span aria-hidden="true">↗</span>
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
