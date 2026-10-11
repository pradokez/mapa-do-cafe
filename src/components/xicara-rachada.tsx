import { XicaraEmLinha } from "@/components/empty-cup-illustration";

/**
 * Xícara rachada, da falha ao carregar (PRD #135): o traço da xícara vazia,
 * sem o vapor, com a rachadura em terracota.
 */
export function XicaraRachada({ className }: { className?: string }) {
  return (
    <XicaraEmLinha className={className}>
      <path d="M60 52l6 10-5 8 4 10" className="text-terracotta" />
    </XicaraEmLinha>
  );
}
