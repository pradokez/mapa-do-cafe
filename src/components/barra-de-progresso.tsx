"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BarraVisual } from "@/components/barra-visual";
import { navegacaoInterna } from "@/lib/navegacao-interna";
import { PRAZO_DO_SERVIDOR_MS } from "@/lib/prazo";

/** Navegação mais rápida que isso (prefetch pronto) não acende a barra. */
const ATRASO_MS = 100;

/**
 * Barra no topo em toda navegação que demora (#137): liga no clique num link
 * que `navegacaoInterna` aprova e apaga quando a rota (caminho ou busca)
 * muda. Não reage a `pushState` dos filtros nem a `router.push`: não há
 * clique em link.
 */
export function BarraDeProgresso() {
  const pathname = usePathname();
  const busca = useSearchParams().toString();
  const [acesa, setAcesa] = useState(false);
  const timers = useRef<number[]>([]);

  function apagar() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setAcesa(false);
  }

  useEffect(() => {
    // Em captura: o `<Link>` do Next cancela o clique para navegar sozinho, e
    // em bolha todo clique nele já chegaria com `defaultPrevented`.
    function aoClicar(evento: MouseEvent) {
      const link = evento.target instanceof Element ? evento.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const alvo = { href: link.href, target: link.target, download: link.hasAttribute("download") };
      if (!navegacaoInterna(evento, alvo, window.location.href)) return;
      apagar();
      timers.current = [
        window.setTimeout(() => setAcesa(true), ATRASO_MS),
        // Trava: navegação cancelada não deixa a barra acesa.
        window.setTimeout(apagar, PRAZO_DO_SERVIDOR_MS),
      ];
    }
    document.addEventListener("click", aoClicar, true);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // A página nova chegou.
  useEffect(apagar, [pathname, busca]);

  return acesa ? <BarraVisual origem="navegacao" /> : null;
}
