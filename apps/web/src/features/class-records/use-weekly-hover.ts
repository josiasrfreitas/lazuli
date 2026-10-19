"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { WeeklyHover, type WeeklyHoverSample } from "./weekly-hover";

type Expand = (id: string | null, pointer?: boolean) => void;
type WeeklyHoverInput = { expand: Expand; keepExpanded: boolean };
type WeeklyHoverHandlers = {
  expand: Expand;
  onPointerMove: (pointer: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (pointer: PointerEvent<HTMLDivElement>) => void;
};

function hoverSample(
  pointer: PointerEvent<HTMLDivElement>,
  currentGroup: string | undefined,
): WeeklyHoverSample | null {
  const target = (pointer.target as Element).closest<HTMLElement>("[data-week-group]");
  const groupId = target?.dataset.weekGroup ?? currentGroup;
  const nodes = [
    ...pointer.currentTarget.querySelectorAll<HTMLElement>("[data-week-group]"),
  ].filter((node) => node.dataset.weekGroup === groupId);
  const first = nodes[0];
  const day = first?.closest(".rbc-events-container")?.getBoundingClientRect();
  if (!first || !groupId || !day || pointer.clientX < day.left || pointer.clientX > day.right)
    return null;
  return {
    groupId,
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
        top: rect.top,
        bottom: rect.bottom,
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
