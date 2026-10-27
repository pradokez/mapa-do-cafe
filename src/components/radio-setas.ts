import type { KeyboardEvent } from "react";

const PASSOS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Setas num `radiogroup`, como num radio nativo: o índice da próxima opção
 * (com volta nas pontas), ou `null` se a tecla não é seta. Na seta, impede a
 * rolagem da página; quem chama marca a opção e move o foco.
 */
export function proximoPelaSeta(e: KeyboardEvent, atual: number, total: number): number | null {
  const passo = PASSOS[e.key];
  if (!passo) return null;
  e.preventDefault();
  return (atual + passo + total) % total;
}
