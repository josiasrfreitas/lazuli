"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { Tabs, TabsList, type TabsProps } from "@lazuli/ui";

const ActiveSection = createContext("");

/** Record pages own their URL, availability rules and panel transitions. */
export function RecordTabs(
  props: Pick<TabsProps, "children" | "onValueChange"> & { value: string },
): ReactElement {
  return (
    <ActiveSection.Provider value={props.value}>
      <Tabs {...props} data-record-tabs variant="underline" size="md" />
    </ActiveSection.Provider>
  );
}

export function RecordTabsList({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}): ReactElement {
  const active = useContext(ActiveSection);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // Move only the tab strip, including when arriving from a deep link.
    const reveal = (): void => {
      const tab = element.querySelector('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      const bounds = element.getBoundingClientRect();
      const selected = tab.getBoundingClientRect();
      if (selected.left < bounds.left) element.scrollLeft += selected.left - bounds.left;
      else if (selected.right > bounds.right) element.scrollLeft += selected.right - bounds.right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    const list = element.querySelector('[role="tablist"]');
    if (list) observer.observe(list);
    return () => observer.disconnect();
  }, [active]);
  return (
    <div
      ref={viewport}
      className="ms-auto flex min-w-0 max-w-full items-center overflow-x-auto scrollbar-subtle"
    >
      <TabsList aria-label={label}>{children}</TabsList>
      {action}
    </div>
  );
}
