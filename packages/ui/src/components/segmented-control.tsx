"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "../lib/utils";

export type SegmentedControlSize = "sm" | "md";

export type SegmentedControlProps = Omit<
  ToggleGroupPrimitive.Props<string>,
  "value" | "defaultValue" | "onValueChange" | "multiple"
> & {
  /** The selected item, or `null` when nothing is selected. */
  value: string | null;
  /** Fires with the new selection; pressing the selected item again clears it. */
  onValueChange: (value: string | null) => void;
  /** Marks the group invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  size?: SegmentedControlSize;
  /** Allow labelled choices to wrap without horizontal scrolling on narrow forms. */
  wrap?: boolean;
};

/**
 * Inline single-choice control for a handful of options (≤ 5) where a
 * dropdown would cost extra clicks. One Tab stop; arrow keys move between
 * items. Name the group via `aria-label` or `aria-labelledby`.
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  (
    {
      children,
      className,
      invalid = false,
      onValueChange,
      size = "md",
      value,
      wrap = false,
      ...props
    },
    ref,
  ) => {
    const groupRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLSpanElement>(null);
    const targetClip = useRef("");
    const previousValue = useRef(value);
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        groupRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      },
      [ref],
    );

    useLayoutEffect(() => {
      const group = groupRef.current;
      const indicator = indicatorRef.current;
      if (!group || !indicator) return;

      const measure = (animate: boolean): void => {
        const selected = group.querySelector<HTMLElement>(
          ':scope > [data-slot="segmented-control-item"][data-pressed]',
        );
        if (!selected) {
          indicator.style.opacity = "0";
          delete group.dataset.indicatorReady;
          return;
        }

        const top = selected.offsetTop;
        const left = selected.offsetLeft;
        const right = group.clientWidth - left - selected.offsetWidth;
        const bottom = group.clientHeight - top - selected.offsetHeight;
        const radius = getComputedStyle(selected).borderRadius;
        const clip = `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius})`;

        // ResizeObserver also fires on subscription. Don't interrupt an ongoing
        // transition when the target geometry hasn't actually changed.
        if (targetClip.current !== clip) {
          if (animate) indicator.dataset.moving = "";
          else delete indicator.dataset.moving;
          indicator.style.clipPath = clip;
          targetClip.current = clip;
        }
        indicator.style.opacity = "1";
        group.dataset.indicatorReady = "";
      };

      measure(previousValue.current !== null && previousValue.current !== value);
      previousValue.current = value;
      const observer = new ResizeObserver(() => measure(false));
      observer.observe(group);
      for (const item of group.querySelectorAll('[data-slot="segmented-control-item"]')) {
        observer.observe(item);
      }
      return () => observer.disconnect();
    }, [value, children, size, wrap]);

    return (
      <ToggleGroupPrimitive
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          [
            "group/segmented relative isolate inline-flex w-fit max-w-full items-stretch gap-0.5 border border-input bg-field p-0.5",
            "transition-[border-color,box-shadow] duration-fast ease-standard",
            "focus-within:border-ring aria-invalid:border-destructive",
            "data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
            size === "sm" && (wrap ? "min-h-control-sm rounded-sm" : "h-control-sm rounded-sm"),
            size === "md" && (wrap ? "min-h-control-md rounded-md" : "h-control-md rounded-md"),
            wrap && "flex-wrap",
          ],
          className,
        )}
        data-invalid={invalid || undefined}
        data-size={size}
        data-wrap={wrap || undefined}
        data-slot="segmented-control"
        onValueChange={(groupValue) => {
          onValueChange(groupValue[0] ?? null);
        }}
        ref={setRef}
        value={value === null ? [] : [value]}
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          data-slot="segmented-control-indicator"
          className={cn(
            "pointer-events-none absolute inset-0 bg-primary opacity-0 transition-opacity duration-base ease-standard",
            "data-moving:transition-[clip-path,opacity]",
            "group-has-[:focus-visible]/segmented:transition-none motion-reduce:data-moving:transition-opacity",
          )}
        />
        {children}
      </ToggleGroupPrimitive>
    );
  },
);

SegmentedControl.displayName = "SegmentedControl";

export type SegmentedControlItemProps = TogglePrimitive.Props & {
  value: string;
};

export const SegmentedControlItem = forwardRef<HTMLButtonElement, SegmentedControlItemProps>(
  ({ className, ...props }, ref) => (
    <TogglePrimitive
      {...props}
      className={cn(
        [
          "relative z-10 inline-flex min-w-0 select-none items-center justify-center whitespace-nowrap px-2.5",
          "text-caption font-medium text-muted-foreground outline-none",
          "hover:text-foreground focus-visible:shadow-focus",
          "data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:text-primary-foreground",
          "group-data-indicator-ready/segmented:data-pressed:bg-transparent",
          "data-disabled:pointer-events-none",
          "group-data-[size=sm]/segmented:rounded-[calc(var(--radius-sm)-2px)]",
          "group-data-[size=md]/segmented:rounded-[calc(var(--radius-md)-2px)]",
          "group-data-[wrap=true]/segmented:min-h-control-sm",
          "group-data-[wrap=true]/segmented:group-data-[size=md]/segmented:min-h-control-md",
        ],
        className,
      )}
      data-slot="segmented-control-item"
      ref={ref}
    />
  ),
);

SegmentedControlItem.displayName = "SegmentedControlItem";
