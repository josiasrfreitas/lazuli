"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { WeeklyHover, type WeeklyHoverSample } from "./weekly-hover";
import { calendarCardNeedsExpansion } from "./content-fit";

type Expand = (id: string | null, pointer?: boolean) => void;
type WeeklyHoverInput = { expand: Expand; keepExpanded: boolean };
type WeeklyHoverHandlers = {
  expand: Expand;
  onPointerMove: (pointer: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (pointer: PointerEvent<HTMLDivElement>) => void;
};

function hoveredGroup(
  pointer: PointerEvent<HTMLDivElement>,
  currentGroup: string | undefined,
): string | undefined {
  const revealed = pointer.currentTarget.querySelector<HTMLElement>('[data-week-revealed="true"]');
  const target = (pointer.target as Element).closest<HTMLElement>("[data-week-group]");
  return revealed?.dataset.weekGroup ?? target?.dataset.weekGroup ?? currentGroup;
}

function pointerTarget(pointer: PointerEvent<HTMLDivElement>): { targetId?: string } {
  const target = (pointer.target as Element).closest<HTMLElement>("[data-week-id]");
  return target?.dataset.weekId ? { targetId: target.dataset.weekId } : {};
}

function hoverSample(
  pointer: PointerEvent<HTMLDivElement>,
  currentGroup: string | undefined,
): WeeklyHoverSample | null {
  const groupId = hoveredGroup(pointer, currentGroup);
  const nodes = [
    ...pointer.currentTarget.querySelectorAll<HTMLElement>("[data-week-group]"),
  ].filter((node) => node.dataset.weekGroup === groupId);
  const first = nodes[0];
  const day = first?.closest(".rbc-events-container")?.getBoundingClientRect();
  if (!first || !groupId || !day || pointer.clientX < day.left || pointer.clientX > day.right)
    return null;
  return {
    groupId,
    ...pointerTarget(pointer),
    left: day.left,
    width: day.width,
    columns: Number(first.dataset.weekColumns),
    revealed: first.dataset.weekRevealed === "true",
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    lanes: nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.weekId!,
        lane: Number(node.dataset.weekLane),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        expandable: calendarCardNeedsExpansion(node),
      };
    }),
  };
}

export function useWeeklyHover({ expand, keepExpanded }: WeeklyHoverInput): WeeklyHoverHandlers {
  const latest = useRef({ expand, keepExpanded });
  const [hover] = useState(
    () =>
      new WeeklyHover((id) => {
        if (!latest.current.keepExpanded) latest.current.expand(id, true);
      }),
  );
  useLayoutEffect(() => {
    latest.current = { expand, keepExpanded };
    if (keepExpanded) hover.reset();
  }, [expand, keepExpanded, hover]);
  useEffect(() => () => hover.reset(), [hover]);
  return {
    expand: (id, pointer) => {
      hover.reset();
      expand(id, pointer);
    },
    onPointerMove: (pointer) => {
      if (
        keepExpanded ||
        pointer.pointerType !== "mouse" ||
        pointer.buttons !== 0 ||
        (pointer.movementX === 0 && pointer.movementY === 0) ||
        !globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches
      )
        return;
      const sample = hoverSample(pointer, hover.groupId);
      if (sample) hover.move(sample);
      else hover.leave();
    },
    onPointerLeave: (pointer) => {
      if (!keepExpanded && !pointer.currentTarget.contains(document.activeElement)) hover.leave();
    },
  };
}
