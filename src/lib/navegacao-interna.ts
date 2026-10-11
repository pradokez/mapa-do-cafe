/**
 * Decide se um clique num link vai trocar a página desta aba por outra do
 * site — o que acende a barra de progresso no topo (#137). Puro: recebe só os
 * campos do evento e do link que importam, sem DOM nem React.
 */

/** O pedaço do `MouseEvent` que decide. */
export type CliqueNoLink = {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/** O link clicado: `href` absoluto (o `a.href` do DOM), `target` e se tem `download`. */
export type Link = { href: string; target: string; download: boolean };

export function navegacaoInterna(clique: CliqueNoLink, link: Link, atual: string): boolean {
  if (clique.button !== 0 || clique.defaultPrevented) return false;
  // Ctrl/Cmd abrem noutra aba, Shift noutra janela, Alt baixa: esta página fica.
  if (clique.ctrlKey || clique.metaKey || clique.shiftKey || clique.altKey) return false;
  if ((link.target && link.target !== "_self") || link.download) return false;

  let destino: URL;
  let origem: URL;
  try {
    destino = new URL(link.href, atual);
    origem = new URL(atual);
  } catch {
    return false;
  }
  // `mailto:`, `tel:` e afins têm origem "null": caem aqui também.
  if (destino.origin !== origem.origin) return false;
  // Só o hash mudando (ou nada) não carrega página.
  return destino.pathname + destino.search !== origem.pathname + origem.search;
}
