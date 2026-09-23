"use client";

import { forwardRef, type ReactElement, type RefAttributes } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const DEFAULT_SIDE_OFFSET = 8;

// The arrow stays inside the panel to follow its animation and collision position.
const popoverArrowClassName = [
  "size-3 -z-10 rotate-45 rounded-[2px] border border-border bg-popover",
  "data-[side=top]:-bottom-1.5 data-[side=bottom]:-top-1.5 data-[side=left]:-right-1.5 data-[side=right]:-left-1.5",
].join(" ");

export const popoverContentVariants = cva(
  [
    "relative rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none",
    "text-caption focus-visible:shadow-focus data-[ending-style]:duration-fast",
    "origin-(--transform-origin) will-change-[opacity,transform] transition-[opacity,transform] duration-base ease-standard",
    "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
    "data-[ending-style]:scale-98 data-[ending-style]:opacity-0",
    "data-[side=top]:data-[starting-style]:translate-y-1.5 data-[side=top]:data-[ending-style]:translate-y-0.5",
    "data-[side=bottom]:data-[starting-style]:-translate-y-1.5 data-[side=bottom]:data-[ending-style]:-translate-y-0.5",
    "data-[side=left]:data-[starting-style]:translate-x-1.5 data-[side=left]:data-[ending-style]:translate-x-0.5",
    "data-[side=right]:data-[starting-style]:-translate-x-1.5 data-[side=right]:data-[ending-style]:-translate-x-0.5",
    "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[starting-style]:scale-100",
  ],
  {
    variants: { size: { sm: "w-56 p-3", md: "w-72 p-4", lg: "w-96 p-4" } },
    defaultVariants: { size: "md" },
  },
);

export type PopoverSize = NonNullable<VariantProps<typeof popoverContentVariants>["size"]>;

/**
 * A non-modal panel anchored to its trigger. Use it for secondary content and
 * short forms; use `Dialog` when the task must interrupt the page, and
 * `Tooltip` for a passive description.
 */
export const Popover = PopoverPrimitive.Root;
export type PopoverProps<Payload = unknown> = PopoverPrimitive.Root.Props<Payload>;

export type PopoverTriggerProps<Payload = unknown> = PopoverPrimitive.Trigger.Props<Payload>;
interface PopoverTriggerComponent {
  <Payload>(props: PopoverTriggerProps<Payload> & RefAttributes<HTMLButtonElement>): ReactElement;
}

/**
 * Unstyled trigger for composition — style comes from the rendered element
 * (e.g. `render={<Button variant="secondary">Filtros</Button>}`).
 */
const PopoverTriggerImpl = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ className, ...props }, ref) => (
    <PopoverPrimitive.Trigger
      {...props}
      className={cn(className)}
      data-slot="popover-trigger"
      ref={ref}
    />
  ),
);
PopoverTriggerImpl.displayName = "PopoverTrigger";
export const PopoverTrigger = PopoverTriggerImpl as PopoverTriggerComponent;

export type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Omit<PopoverPrimitive.Positioner.Props, keyof PopoverPrimitive.Popup.Props | "children"> &
  VariantProps<typeof popoverContentVariants> & {
    /** Hides the tail that points back at the trigger. */
    showArrow?: boolean;
  };
type PopoverPositionerOnlyProps = Omit<
  PopoverPrimitive.Positioner.Props,
  keyof PopoverPrimitive.Popup.Props | "children"
>;

/**
 * Splits the flat prop bag into the positioner's placement props and the
 * popup's own props, so consumers configure both through one component.
 */
function splitContentProps({
  align,
  alignOffset,
  anchor,
  arrowPadding,
  collisionAvoidance,
  collisionBoundary,
  collisionPadding,
  disableAnchorTracking,
  positionMethod,
  side = "bottom",
  sideOffset = DEFAULT_SIDE_OFFSET,
  sticky,
  ...popupProps
}: PopoverContentProps): {
  popupProps: Omit<PopoverContentProps, keyof PopoverPositionerOnlyProps>;
  positionerProps: PopoverPositionerOnlyProps;
} {
  return {
    popupProps,
    positionerProps: {
      align,
      alignOffset,
      anchor,
      arrowPadding,
      // A popover stays on its requested axis. If there is no room below,
      // it may flip above, but it should not unexpectedly open beside its trigger.
      collisionAvoidance: {
        ...collisionAvoidance,
        fallbackAxisSide: collisionAvoidance?.fallbackAxisSide ?? "none",
      },
      collisionBoundary,
      collisionPadding,
      disableAnchorTracking,
      positionMethod,
      side,
      sideOffset,
      sticky,
    },
  };
}

/**
 * The positioned popover panel. It portals to the document body and opens
 * below its trigger by default.
 */
export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>((props, ref) => {
  const { popupProps, positionerProps } = splitContentProps(props);
  const { children, className, showArrow = true, size, ...restPopupProps } = popupProps;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        {...positionerProps}
        className="z-50"
        data-slot="popover-positioner"
      >
        <PopoverPrimitive.Popup
          {...restPopupProps}
          className={cn(popoverContentVariants({ size }), className)}
          data-slot="popover-content"
          ref={ref}
        >
          {showArrow ? (
            <PopoverPrimitive.Arrow className={popoverArrowClassName} data-slot="popover-arrow" />
          ) : null}
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";

export type PopoverTitleProps = PopoverPrimitive.Title.Props;
export const PopoverTitle = forwardRef<HTMLHeadingElement, PopoverTitleProps>(
  ({ className, ...props }, ref) => (
    <PopoverPrimitive.Title
      {...props}
      className={cn("text-control font-display font-semibold", className)}
      data-slot="popover-title"
      ref={ref}
    />
  ),
);
PopoverTitle.displayName = "PopoverTitle";

export type PopoverDescriptionProps = PopoverPrimitive.Description.Props;
export const PopoverDescription = forwardRef<HTMLParagraphElement, PopoverDescriptionProps>(
  ({ className, ...props }, ref) => (
    <PopoverPrimitive.Description
      {...props}
      className={cn("text-caption text-muted-foreground", className)}
      data-slot="popover-description"
      ref={ref}
    />
  ),
);
PopoverDescription.displayName = "PopoverDescription";

export type PopoverCloseProps = PopoverPrimitive.Close.Props;
/**
 * Unstyled close control for composition — style comes from the rendered
 * element (e.g. `render={<Button variant="secondary">Cancelar</Button>}`).
 */
export const PopoverClose = forwardRef<HTMLButtonElement, PopoverCloseProps>(
  ({ className, ...props }, ref) => (
    <PopoverPrimitive.Close
      {...props}
      className={cn(className)}
      data-slot="popover-close"
      ref={ref}
    />
  ),
);
PopoverClose.displayName = "PopoverClose";
