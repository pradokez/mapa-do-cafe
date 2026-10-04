"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef } from "react";

import { FotoDoStorage } from "@/components/foto-do-storage";

import { Erro } from "./form";

type Props = {
  /** A foto a remover; `null` fecha o diálogo. */
  foto: { url: string; alt: string } | null;
  removendo: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Quem abriu decide para onde o foco vai ao fechar (o botão pode ter sumido). */
  onCloseAutoFocus: (evento: Event) => void;
};

/**
 * Confirmação da remoção (#51), com a miniatura para não remover a foto
 * errada. Radix Dialog: foco preso, Esc e fundo cancelam, `alertdialog`
 * rotulado pelo título. O foco começa em "Cancelar" — o destrutivo nunca é
 * o padrão. Enquanto remove, não fecha.
 */
export function RemoverFotoDialog({ foto, removendo, erro, onConfirmar, onCancelar, onCloseAutoFocus }: Props) {
  const cancelar = useRef<HTMLButtonElement>(null);

  return (
    <DialogPrimitive.Root
      open={foto !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !removendo) onCancelar();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-espresso/45" />
        <DialogPrimitive.Content
          role="alertdialog"
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            cancelar.current?.focus();
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream p-6 focus:outline-none"
        >
          <DialogPrimitive.Title className="font-display text-[21px] text-espresso">
            Remover esta foto?
          </DialogPrimitive.Title>
          {foto && (
            // width/height só dão a proporção; quem manda no tamanho é a classe.
            <FotoDoStorage
              src={foto.url}
              alt={foto.alt}
              width={352}
              height={160}
              className="mt-4 h-[160px] w-full rounded-lg border border-card-line object-cover"
            />
          )}
          <DialogPrimitive.Description className="mt-4 text-[14.5px] text-ink-2">
            Ela sai do site e do Storage. Não dá para desfazer.
          </DialogPrimitive.Description>
          <Erro erro={erro} className="mt-3" />
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              ref={cancelar}
              type="button"
              onClick={onCancelar}
              disabled={removendo}
              className="h-11 rounded-full border border-line-strong bg-white px-5 text-[14px] font-semibold text-espresso hover:bg-hover-soft disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={removendo}
              className="h-11 rounded-full bg-terracotta px-5 text-[14px] font-semibold text-on-terracotta hover:bg-terracotta-hover disabled:opacity-60"
            >
              {removendo ? "Removendo…" : "Remover foto"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
