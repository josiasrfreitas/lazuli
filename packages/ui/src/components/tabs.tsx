"use client";

import { createContext, forwardRef, useContext } from "react";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

export const tabsListVariants = cva("relative inline-flex items-center", {
  variants: {
    variant: {
      /** Prototype's status filter: a sunken track with the active tab filled. */
      segmented: "gap-1 rounded-md bg-muted p-1",
      /** Page-level navigation: tabs sit on a single rule. */
      underline: "gap-4 border-b border-border",
    },
  },
  defaultVariants: {
    variant: "segmented",
  },
});

export const tabsTabVariants = cva(
  [
    "relative z-10 inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap",
    "font-medium text-muted-foreground transition-colors duration-fast ease-standard",
    "hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus",
    // Base UI marks the active tab with `data-active`, not `data-selected`.
    "data-[active]:text-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-disabled",
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      size: {
        sm: "h-control-sm rounded-sm px-3 text-caption",
        md: "h-control-md rounded-md px-4 text-control",
      },
      activeWeight: {
        medium: "data-[active]:font-medium",
        semibold: "data-[active]:font-semibold",
      },
    },
    defaultVariants: {
      size: "sm",
      activeWeight: "semibold",
    },
  },
);

const tabsIndicatorVariants = cva(
  [
    "absolute left-0 z-0 w-(--active-tab-width) translate-x-(--active-tab-left)",
    "transition-[translate,width] duration-base ease-standard motion-reduce:transition-none",
  ],
  {
    variants: {
      variant: {
        // Sits behind the tabs (`z-0` under their `z-10`) and fills the active
        // one, so the label keeps its own color instead of being covered. The
        // vertical translate is what clears the list's own padding.
        segmented:
          "top-0 h-(--active-tab-height) translate-y-(--active-tab-top) rounded-sm bg-card shadow-sm",
        // Rides the list's bottom rule; `-bottom-px` covers the border itself.
        underline: "-bottom-px h-0.5 rounded-full bg-foreground",
      },
    },
    defaultVariants: {
      variant: "segmented",
    },
  },
);

export type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>;
export type TabsSize = NonNullable<VariantProps<typeof tabsTabVariants>["size"]>;
export type TabsActiveWeight = NonNullable<VariantProps<typeof tabsTabVariants>["activeWeight"]>;

interface TabsContextValue {
  size: TabsSize;
  variant: TabsVariant;
  activeWeight: TabsActiveWeight;
}

// The appearance is chosen once on the root so every tab in a list cannot drift
// out of sync with its indicator; `TabsTab` reads it instead of repeating props.
const TabsContext = createContext<TabsContextValue>({
  size: "sm",
  variant: "segmented",
  activeWeight: "semibold",
});

export type TabsProps = TabsPrimitive.Root.Props & {
  /** Height and type scale of every tab in this root. */
  size?: TabsSize;
  /** Appearance shared by the list, its tabs, and the indicator. */
  variant?: TabsVariant;
  /** Weight of the active label; use `medium` to keep tab widths stable. */
  activeWeight?: TabsActiveWeight;
};

/**
 * A set of panels with one visible at a time. Use it for switching views of the
 * same data; use links and routes when the sections are separate pages.
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, size = "sm", variant = "segmented", activeWeight = "semibold", ...props }, ref) => (
    <TabsContext.Provider value={{ size, variant, activeWeight }}>
      <TabsPrimitive.Root
        {...props}
        className={cn("flex flex-col gap-4", className)}
        data-slot="tabs"
        ref={ref}
      />
    </TabsContext.Provider>
  ),
);

Tabs.displayName = "Tabs";

export type TabsListProps = TabsPrimitive.List.Props;

/**
 * Groups the tab buttons and renders the moving indicator behind them.
 */
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className, ...props }, ref) => {
    const { variant } = useContext(TabsContext);

    return (
      <TabsPrimitive.List
        {...props}
        className={cn(tabsListVariants({ variant }), className)}
        data-slot="tabs-list"
        ref={ref}
      >
        {children}
        <TabsPrimitive.Indicator
          className={cn(tabsIndicatorVariants({ variant }))}
          data-slot="tabs-indicator"
          renderBeforeHydration
        />
      </TabsPrimitive.List>
    );
  },
);

TabsList.displayName = "TabsList";

export type TabsTabProps = TabsPrimitive.Tab.Props;

export const TabsTab = forwardRef<HTMLButtonElement, TabsTabProps>(
  ({ className, ...props }, ref) => {
    const { size, variant, activeWeight } = useContext(TabsContext);

    return (
      <TabsPrimitive.Tab
        {...props}
        className={cn(
          tabsTabVariants({ size, activeWeight }),
          variant === "underline" && "px-1",
          className,
        )}
        data-slot="tabs-tab"
        ref={ref}
      />
    );
  },
);

TabsTab.displayName = "TabsTab";

export type TabsPanelProps = TabsPrimitive.Panel.Props;

export const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Panel
      {...props}
      className={cn("focus-visible:outline-none focus-visible:shadow-focus", className)}
      data-slot="tabs-panel"
      ref={ref}
    />
  ),
);

TabsPanel.displayName = "TabsPanel";
