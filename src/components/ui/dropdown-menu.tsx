"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { CheckIcon } from "@/components/icons";

/**
 * shadcn/ui DropdownMenu (Radix), só com as partes em uso e estilizado com os
 * tokens da paleta. Teclado (setas, Home/End, type-ahead, Esc), foco de volta
 * ao gatilho e ARIA (`menu`, `menuitemcheckbox`) vêm do Radix.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className = "", sideOffset = 6, ...props }, ref) => (
  // Portal: a barra de filtros rola de lado (`overflow-x-auto`) e cortaria o menu.
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`z-50 max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(44,26,14,.3)] ${className}`}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

/** Linha do design: 38 px, marca ✓ terracota à direita e semibold quando marcada. */
export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className = "", children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={`flex h-[38px] cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 text-sm text-espresso outline-offset-[-2px] data-[highlighted]:bg-hover-soft data-[state=checked]:font-semibold ${className}`}
    {...props}
  >
    {children}
    <DropdownMenuPrimitive.ItemIndicator className="text-terracotta">
      <CheckIcon size={16} strokeWidth={2.2} />
    </DropdownMenuPrimitive.ItemIndicator>
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;
