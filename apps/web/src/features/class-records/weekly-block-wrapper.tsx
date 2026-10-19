import { cloneElement, type HTMLAttributes, type ReactElement } from "react";
import type { EventWrapperProps } from "react-big-calendar";
import { useWeeklyBlock } from "./weekly-block-context";
import type { WeeklyBlock } from "./weekly-blocks";

/** Preserve the library's geometry while making the block a group of real buttons. */
export function WeeklyBlockWrapper({
  event,
  children,
}: EventWrapperProps<WeeklyBlock> & {
  children?: ReactElement<HTMLAttributes<HTMLElement>>;
}): ReactElement | null {
  const { expandedId, expand, keepExpanded } = useWeeklyBlock();
  if (!children) return null;
  const expanded = expandedId === event.id || event.revealed;
  const attributes = {
    "data-week-group": event.groupId,
    "data-week-id": event.id,
    "data-week-lane": event.lane,
    "data-week-columns": event.columns,
    "data-week-revealed": event.revealed,
  };
  return cloneElement(children, {
    ...attributes,
    role: "group",
    tabIndex: undefined,
    title: undefined,
    "aria-label": event.title,
    onClick: undefined,
    onKeyDown: (key) => {
      if (key.key !== "Escape" || !expanded) return;
      key.stopPropagation();
      key.currentTarget.closest<HTMLElement>('[role="region"]')?.focus();
      expand(null);
    },
    onFocusCapture: (focus) => {
      if (event.kind !== "overflow" && focus.target.matches(":focus-visible")) expand(event.id);
    },
    onBlurCapture: (focus) => {
      if (expanded && !keepExpanded && !focus.currentTarget.contains(focus.relatedTarget))
        expand(null);
    },
  });
}
