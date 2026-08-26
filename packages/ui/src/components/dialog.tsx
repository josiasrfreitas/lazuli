"use client";

import { forwardRef, type ReactElement, type RefAttributes } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";
import { DialogCloseButton } from "./dialog-layout";

export { DialogBody, DialogCloseButton, DialogFooter, DialogHeader } from "./dialog-layout";
export type {
  DialogBodyProps,
  DialogCloseButtonProps,
  DialogFooterProps,
  DialogHeaderProps,
} from "./dialog-layout";

/**
 * A modal dialog root. It supports controlled and uncontrolled open state,
 * focus management, and pointer or keyboard dismissal through Base UI.
 */
export const Dialog = DialogPrimitive.Root;

export type DialogProps<Payload = unknown> = DialogPrimitive.Root.Props<Payload>;

export type DialogTriggerProps<Payload = unknown> = DialogPrimitive.Trigger.Props<Payload>;

interface DialogTriggerComponent {
  <Payload>(props: DialogTriggerProps<Payload> & RefAttributes<HTMLButtonElement>): ReactElement;
}

const DialogTriggerImpl = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Trigger
      {...props}
      className={cn(className)}
      data-slot="dialog-trigger"
      ref={ref}
    />
  ),
);

DialogTriggerImpl.displayName = "DialogTrigger";

export const DialogTrigger = DialogTriggerImpl as DialogTriggerComponent;

export type DialogPortalProps = DialogPrimitive.Portal.Props;

export const DialogPortal = forwardRef<HTMLDivElement, DialogPortalProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Portal
      {...props}
      className={cn(className)}
      data-slot="dialog-portal"
      ref={ref}
    />
  ),
);

DialogPortal.displayName = "DialogPortal";

export type DialogBackdropProps = DialogPrimitive.Backdrop.Props;

export const DialogBackdrop = forwardRef<HTMLDivElement, DialogBackdropProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Backdrop
      {...props}
      className={cn(
        [
          "fixed inset-0 z-50 bg-overlay backdrop-blur-sm",
          "transition-[opacity,backdrop-filter] duration-base ease-standard motion-reduce:transition-none",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        ],
        className,
      )}
      data-slot="dialog-backdrop"
      ref={ref}
    />
  ),
);

DialogBackdrop.displayName = "DialogBackdrop";

export const dialogContentVariants = cva([
  "fixed inset-x-4 top-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-auto -translate-y-1/2 flex-col overflow-hidden",
  "rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none",
  "transition-[opacity,transform] duration-base ease-standard motion-reduce:transition-none",
  "focus-visible:shadow-focus data-[starting-style]:translate-y-[calc(-50%+0.5rem)] data-[starting-style]:opacity-0",
  "data-[ending-style]:translate-y-[calc(-50%+0.5rem)] data-[ending-style]:opacity-0",
  "md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2",
]);

export type DialogContentProps = DialogPrimitive.Popup.Props & {
  /** Accessible name of the built-in close button. */
  closeLabel?: string;
  /** Hides the built-in close button rendered in the top-right corner. */
  showCloseButton?: boolean;
};

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ children, className, closeLabel = "Fechar", showCloseButton = true, ...props }, ref) => (
    <DialogPrimitive.Popup
      {...props}
      className={cn(dialogContentVariants(), className)}
      data-slot="dialog-content"
      ref={ref}
    >
      {showCloseButton ? <DialogCloseButton aria-label={closeLabel} /> : null}
      {children}
    </DialogPrimitive.Popup>
  ),
);

DialogContent.displayName = "DialogContent";

export type DialogTitleProps = DialogPrimitive.Title.Props;

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      {...props}
      className={cn("text-h3 font-display font-semibold", className)}
      data-slot="dialog-title"
      ref={ref}
    />
  ),
);

DialogTitle.displayName = "DialogTitle";

export type DialogDescriptionProps = DialogPrimitive.Description.Props;

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      {...props}
      className={cn("text-caption text-muted-foreground", className)}
      data-slot="dialog-description"
      ref={ref}
    />
  ),
);

DialogDescription.displayName = "DialogDescription";

export type DialogCloseProps = DialogPrimitive.Close.Props;

/**
 * Unstyled close control for composition — style comes from the rendered
 * element (e.g. `render={<Button variant="secondary">Cancelar</Button>}`).
 * The dialog's corner "X" is built into `DialogContent`.
 */
export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Close
      {...props}
      className={cn(className)}
      data-slot="dialog-close"
      ref={ref}
    />
  ),
);

DialogClose.displayName = "DialogClose";
