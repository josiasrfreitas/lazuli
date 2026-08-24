"use client";

import { forwardRef, type ReactElement, type RefAttributes } from "react";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "../lib/utils";

const DEFAULT_SIDE_OFFSET = 8;

// The tail is rendered inside the panel rather than beside it: nested, it
// inherits the panel's transform and so scales and fades in lockstep instead of
// drifting as a detached diamond, while the primitive still drives its
// along-axis coordinate so it keeps pointing at the trigger when a collision
// shifts the panel. `-z-10` slips it under the panel background, which is only
// possible because the panel opens no stacking context — the positioner owns
// the `z-50`.
const tooltipTailClassName = [
  "size-3 -z-10 rotate-45 rounded-[2px] border border-border bg-popover",
  "data-[side=top]:-bottom-1.5 data-[side=bottom]:-top-1.5",
  "data-[side=left]:-right-1.5 data-[side=right]:-left-1.5",
].join(" ");

const tooltipContentClassName = [
  "relative max-w-xs rounded-lg border border-border bg-popover px-3 py-2",
  "text-micro leading-4 text-popover-foreground shadow-lg",
  "origin-(--transform-origin) will-change-[opacity,transform] transition-[opacity,transform] duration-base ease-standard",
  "data-[ending-style]:duration-fast",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-98 data-[ending-style]:opacity-0",
  "data-[side=top]:data-[starting-style]:translate-y-1.5 data-[side=top]:data-[ending-style]:translate-y-0.5",
  "data-[side=bottom]:data-[starting-style]:-translate-y-1.5 data-[side=bottom]:data-[ending-style]:-translate-y-0.5",
  "data-[side=left]:data-[starting-style]:translate-x-1.5 data-[side=left]:data-[ending-style]:translate-x-0.5",
  "data-[side=right]:data-[starting-style]:-translate-x-1.5 data-[side=right]:data-[ending-style]:-translate-x-0.5",
  "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[starting-style]:scale-100",
].join(" ");

/**
 * Shared delay configuration for a group of tooltips.
 */
export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * An accessible, non-essential description for a control.
 */
export const Tooltip = TooltipPrimitive.Root;

export type TooltipProps<Payload = unknown> = TooltipPrimitive.Root.Props<Payload>;

export type TooltipTriggerProps<Payload = unknown> = TooltipPrimitive.Trigger.Props<Payload>;

interface TooltipTriggerComponent {
  <Payload>(props: TooltipTriggerProps<Payload> & RefAttributes<HTMLButtonElement>): ReactElement;
}

const TooltipTriggerImpl = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ className, ...props }, ref) => (
    <TooltipPrimitive.Trigger
      {...props}
      className={cn(className)}
      data-slot="tooltip-trigger"
      ref={ref}
    />
  ),
);

TooltipTriggerImpl.displayName = "TooltipTrigger";

export const TooltipTrigger = TooltipTriggerImpl as TooltipTriggerComponent;

export type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Omit<TooltipPrimitive.Positioner.Props, keyof TooltipPrimitive.Popup.Props | "children">;

/**
 * The positioned tooltip panel. It portals to the document body and is placed
 * above its trigger by default.
 */
export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    {
      align,
      alignOffset,
      anchor,
      arrowPadding,
      children,
      className,
      collisionAvoidance,
      collisionBoundary,
      collisionPadding,
      disableAnchorTracking,
      positionMethod,
      side = "top",
      sideOffset = DEFAULT_SIDE_OFFSET,
      sticky,
      ...popupProps
    },
    ref,
  ) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        arrowPadding={arrowPadding}
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        disableAnchorTracking={disableAnchorTracking}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
        className="z-50"
        data-slot="tooltip-positioner"
      >
        <TooltipPrimitive.Popup
          {...popupProps}
          className={cn(tooltipContentClassName, className)}
          data-slot="tooltip-content"
          ref={ref}
        >
          <TooltipPrimitive.Arrow className={tooltipTailClassName} data-slot="tooltip-arrow" />
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  ),
);

TooltipContent.displayName = "TooltipContent";
