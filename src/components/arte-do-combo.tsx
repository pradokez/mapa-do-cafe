"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState } from "react";

import { FotoDoStorage } from "@/components/foto-do-storage";
import { ExpandIcon, XIcon } from "@/components/icons";

type Props = {
  arte: string;
  /** Transcrição da arte — o texto do combo está dentro da imagem. */
  alt: string;
  /** Nome do diálogo para o leitor de tela ("Combo 13 · Eu Amo Café"). */
  titulo: string;
  credito: string;
};

/**
 * Arte do combo (#103), inteira (4:5, `object-contain` — o texto está nela),
 * que se amplia num Radix Dialog: Esc e o fundo fecham, e o foco volta ao
 * botão. Único pedaço do bloco que precisa de JS.
 */
export function ArteDoCombo({ arte, alt, titulo, credito }: Props) {
  const [aberta, setAberta] = useState(false);
  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={setAberta}>
      <DialogPrimitive.Trigger
        aria-label="Ampliar arte do combo"
        className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-[14px] bg-hover-soft lg:rounded-xl"
      >
        <FotoDoStorage
          src={arte}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 240px, 100vw"
          className="object-contain transition-opacity group-hover:opacity-95"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-2.5 flex size-[34px] items-center justify-center rounded-full bg-white/90 text-espresso"
        >
          <ExpandIcon size={16} strokeWidth={2} />
        </span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-lightbox lg:bg-lightbox/90" />
        {/* Tela inteira, para o "Fechar" ficar dentro do foco preso; o toque fora da arte fecha. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setAberta(false);
          }}
          className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-2.5 px-4 focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{titulo}</DialogPrimitive.Title>
          <div className="relative aspect-[4/5] w-[min(calc(100vw-32px),calc((100dvh-136px)*0.8))] cursor-default overflow-hidden rounded-[10px] bg-hover-soft">
            <FotoDoStorage src={arte} alt={alt} fill sizes="100vw" className="object-contain" />
          </div>
          <span className="cursor-default text-xs text-line-strong">{credito}</span>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-cream text-espresso focus-visible:outline-cream"
          >
            <XIcon size={18} strokeWidth={2.2} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
