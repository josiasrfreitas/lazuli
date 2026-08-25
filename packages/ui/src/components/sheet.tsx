"use client";

import { forwardRef } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";
import { DialogCloseButton } from "./dialog";

/*
 * Side panel anchored to the right edge, for previews that keep the page
 * behind them in context. A thin skin over the dialog primitives: everything
 * except the popup itself is the dialog part under a sheet name, so focus
 * trapping, Esc, and focus return behave exactly like `Dialog`.
 */
export {
  Dialog as Sheet,
  DialogBackdrop as SheetBackdrop,
  DialogBody as SheetBody,
  DialogClose as SheetClose,
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
  DialogHeader as SheetHeader,
  DialogPortal as SheetPortal,
  DialogTitle as SheetTitle,
  DialogTrigger as SheetTrigger,
} from "./dialog";

export type {
  DialogBackdropProps as SheetBackdropProps,
  DialogBodyProps as SheetBodyProps,
  DialogCloseProps as SheetCloseProps,
  DialogDescriptionProps as SheetDescriptionProps,
  DialogFooterProps as SheetFooterProps,
  DialogHeaderProps as SheetHeaderProps,
  DialogPortalProps as SheetPortalProps,
  DialogProps as SheetProps,
  DialogTitleProps as SheetTitleProps,
  DialogTriggerProps as SheetTriggerProps,
} from "./dialog";

export const sheetContentVariants = cva(
  [
    "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden",
    "border-l border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none",
    "transition-[opacity,transform] duration-base ease-standard",
    "focus-visible:shadow-focus data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
  ],
  {
    variants: {
      // Widths apply from `md` up; below that the sheet takes the full width.
      size: {
        sm: "md:max-w-sm",
        md: "md:max-w-md",
        lg: "md:max-w-xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type SheetSize = NonNullable<VariantProps<typeof sheetContentVariants>["size"]>;

export type SheetContentProps = DialogPrimitive.Popup.Props &
  VariantProps<typeof sheetContentVariants> & {
    /** Accessible name of the built-in close button. */
    closeLabel?: string;
    /** Hides the built-in close button rendered in the top-right corner. */
    showCloseButton?: boolean;
  };

export const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(
  ({ children, className, closeLabel = "Fechar", showCloseButton = true, size, ...props }, ref) => (
    <DialogPrimitive.Popup
      {...props}
      className={cn(sheetContentVariants({ size }), className)}
      data-slot="sheet-content"
      ref={ref}
    >
      {showCloseButton ? <DialogCloseButton aria-label={closeLabel} /> : null}
      {children}
    </DialogPrimitive.Popup>
  ),
);

SheetContent.displayName = "SheetContent";
