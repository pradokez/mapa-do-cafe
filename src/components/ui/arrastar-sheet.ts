import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Só para testes: arrasta um bottom sheet (`ui/sheet.tsx`) de `de` até `ate`
 * (clientY) em `ms` milissegundos. O jsdom não tem layout: o sheet é simulado
 * com 600 px de altura. Quem usa restaura os mocks (`vi.restoreAllMocks`).
 */
export function arrastar(
  el: Element,
  de: number,
  ate: number,
  ms: number,
  { pausa = 0, fim = "pointerUp" }: { pausa?: number; fim?: "pointerUp" | "pointerCancel" } = {},
) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 600 } as DOMRect);
  vi.useFakeTimers({ toFake: ["performance"] });
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientY: de });
  vi.advanceTimersByTime(ms / 2);
  fireEvent.pointerMove(el, { pointerId: 1, clientY: (de + ate) / 2 });
  vi.advanceTimersByTime(ms / 2);
  fireEvent.pointerMove(el, { pointerId: 1, clientY: ate });
  // Dedo parado antes de soltar.
  vi.advanceTimersByTime(pausa);
  fireEvent[fim](el, { pointerId: 1, clientY: ate });
  vi.useRealTimers();
}
