"use client";

import { useState } from "react";

import { FotoDoStorage } from "@/components/foto-do-storage";
import { Bloco } from "@/components/skeleton";

type Props = {
  src: string;
  alt: string;
  priority: boolean;
  loading: "eager" | "lazy" | undefined;
  className: string;
};

/**
 * Foto do Storage chegando (#140): o brilho do skeleton (tom do branco) por
 * baixo até o `onLoad`, e a foto entra com fade de .4 s (sem fade com
 * `prefers-reduced-motion`). Se ela falha, o brilho para e a imagem quebrada
 * fica escondida. Foto já em cache antes da hidratação: o `next/image` chama
 * `onLoad` assim que hidrata. Sem JS, o `<noscript>` do layout raiz mostra a
 * foto (`data-foto`). Quem usa dá um `key` por `src`, para trocar de foto zerar
 * o estado.
 */
export function FotoComBrilho({ src, alt, priority, loading, className }: Props) {
  const [estado, setEstado] = useState<"carregando" | "carregada" | "erro">("carregando");

  return (
    <>
      {estado !== "carregada" && <Bloco parado={estado === "erro"} className="absolute inset-0" />}
      <FotoDoStorage
        data-foto=""
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={loading}
        onLoad={() => setEstado("carregada")}
        onError={() => setEstado("erro")}
        className={`${className} ${estado === "carregada" ? "opacity-100 motion-safe:transition-opacity motion-safe:duration-[400ms]" : "opacity-0"}`}
      />
    </>
  );
}
