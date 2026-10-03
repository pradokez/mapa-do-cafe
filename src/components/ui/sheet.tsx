"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

/**
 * shadcn/ui Sheet (Radix Dialog), só o lado de baixo e só as partes em uso,
 * com as medidas do bottom sheet do design (raio 24 px no topo, alça 40×4).
 * Foco preso, Esc e clique no fundo fecham, foco volta ao gatilho e ARIA
 * (`dialog` rotulado pelo título) vêm do Radix. A alça é decorativa: não arrasta.
 */
export const Sheet = DialogPrimitive.Root;

export const SheetTrigger = DialogPrimitive.Trigger;

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`mb-1.5 font-display text-[21px] text-espresso ${className}`}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className = "", children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-espresso/45" />
    <DialogPrimitive.Content
      ref={ref}
      // Sem descrição: o título e as opções bastam.
      aria-describedby={undefined}
      className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[24px] bg-cream px-[18px] pb-[26px] pt-2.5 focus:outline-none ${className}`}
      {...props}
    >
      <span aria-hidden="true" className="mb-2.5 h-1 w-10 flex-none self-center rounded-full bg-chip-line" />
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;
