// Peças de formulário do admin, comuns ao login e às seções do painel.

export const inputClass =
  "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[16px] text-espresso placeholder:text-placeholder";
export const labelClass = "mb-1.5 block text-[13.5px] font-semibold text-ink-2";
/** Borda de erro no campo marcado com `aria-invalid`. */
export const invalidoClass = "aria-[invalid=true]:border-terracotta";

/** A action nem respondeu (rede caiu, servidor fora). */
export const ERRO_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

/** `AAAA-MM-DD` → `DD/MM/AAAA`, como a data de autorização aparece no painel. */
export const dataBr = (iso: string) => iso.split("-").reverse().join("/");

const botaoClass = "h-[46px] rounded-full px-6 text-[14.5px] font-semibold transition-colors disabled:opacity-60";
export const botaoCtaClass = `${botaoClass} bg-terracotta text-on-terracotta hover:bg-terracotta-hover`;
export const botaoNeutroClass = `${botaoClass} border border-line-strong bg-white text-espresso hover:bg-hover-soft`;

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
