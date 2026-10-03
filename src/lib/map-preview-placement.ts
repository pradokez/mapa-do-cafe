// Geometria do preview flutuante do mapa (design › home desktop). Puro: quem
// chama projeta o pin para pixels do container; aqui só se decide onde o
// cartão de 280 px cabe.

export const PREVIEW_WIDTH = 280;

// Margem mínima entre o preview e a borda do mapa.
const EDGE = 16;
// Pin ativo tem 40 px × 1,3 ≈ 52 px: acima, o preview flutua 2 px sobre a cabeça.
const GAP_ABOVE = 54;
// Abaixo, o preview desce logo depois da ponta do pin.
const GAP_BELOW = 14;

type Point = { x: number; y: number };
type Size = { width: number; height: number };

export type PreviewPlacement = {
  placement: "above" | "below";
  /** Borda esquerda do preview, em px do container do mapa. */
  left: number;
  /** `above`: onde fica a borda **de baixo** do preview. `below`: a borda de cima. */
  y: number;
};

/**
 * Onde abrir o preview de um pin. `pin` é a ponta do pin, em px relativos ao
 * container. Acima do pin por padrão; no terço superior do mapa, abaixo —
 * senão o cartão sairia pelo topo. Na horizontal, centralizado no pin e preso
 * a 16 px das bordas.
 */
export function placePreview(pin: Point, map: Size): PreviewPlacement {
  const left = Math.max(EDGE, Math.min(pin.x - PREVIEW_WIDTH / 2, map.width - PREVIEW_WIDTH - EDGE));
  if (pin.y < map.height / 3) return { placement: "below", left, y: pin.y + GAP_BELOW };
  return { placement: "above", left, y: pin.y - GAP_ABOVE };
}
