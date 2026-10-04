// Peças de formulário do admin, comuns ao login e às seções do café.

export const inputClass =
  "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[16px] text-espresso placeholder:text-placeholder";
export const labelClass = "mb-1.5 block text-[13.5px] font-semibold text-ink-2";

/**
 * Mensagem de erro anunciada ao aparecer. Fica sempre no DOM (vazia some), para
 * o leitor de tela já conhecer a região; o `id` liga ao campo por `aria-describedby`.
 */
export function Erro({ erro, id, className = "" }: { erro?: string | null; id?: string; className?: string }) {
  return (
    <p id={id} role="alert" className={`text-[14px] font-medium text-terracotta empty:hidden ${className}`}>
      {erro}
    </p>
  );
}
