"use client";

import { useState, type RefObject } from "react";
import { revealWeeklyBlocks, type WeeklyBlock } from "./weekly-blocks";
import { useTimelineExpansion } from "./use-timeline-expansion";

type WeeklyExpansion = {
  timelineRef: RefObject<HTMLDivElement | null>;
  expandedId: string | null;
  displayed: WeeklyBlock[];
  expand: (id: string | null, pointer?: boolean) => void;
};

export function useWeeklyExpansion(events: WeeklyBlock[]): WeeklyExpansion {
  const { timelineRef, expandedId, expand } = useTimelineExpansion();
  const [revealedGroup, setRevealedGroup] = useState<string | null>(null);
  const displayed = revealWeeklyBlocks(events, revealedGroup);
  return {
    timelineRef,
    expandedId,
    displayed,
    expand: (id, pointer) => {
      const event =
        displayed.find((item) => item.id === id) ?? events.find((item) => item.id === id);
      if (pointer && event?.kind === "overflow") return;
      setRevealedGroup(event?.kind === "overflow" || event?.revealed ? event.groupId : null);
      expand(id, pointer);
    },
  };
}
