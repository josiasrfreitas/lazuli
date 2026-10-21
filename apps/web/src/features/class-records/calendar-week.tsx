"use client";

import { useEffect, useLayoutEffect, useRef, type ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { calendarDate, shiftDate } from "./calendar-model";
import styles from "./calendar.module.css";

type CalendarWeekInput = {
  compact?: boolean;
  from: string;
  today: string;
  date: string;
  onSelectDay: (date: string) => void;
  onChangeWeek: (from: string) => void;
};

/** Three adjacent weeks form one continuous rail, including touch momentum. */
export function CalendarWeek({
  from,
  today,
  date,
  onSelectDay,
  onChangeWeek,
  compact = false,
}: CalendarWeekInput): ReactElement {
  const rail = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changing = useRef(false);

  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    changing.current = false;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    node.scrollTo({ left: node.clientWidth, behavior: "instant" });
  }, [from]);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      node.scrollTo({ left: node.clientWidth, behavior: "instant" });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  function settle(): void {
    const node = rail.current;
    if (!node || !node.clientWidth || changing.current) return;
    const offset = Math.round(node.scrollLeft / node.clientWidth) - 1;
    if (offset === 0) return;
    changing.current = true;
    onChangeWeek(shiftDate(from, offset * 7));
  }

  function move(direction: number, pointer: boolean): void {
    const node = rail.current;
    if (!node || changing.current) return;
    if (!pointer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onChangeWeek(shiftDate(from, direction * 7));
      return;
    }
    node.scrollTo({ left: node.clientWidth * (1 + direction), behavior: "smooth" });
  }

  return (
    <div className={styles.week} data-compact={compact} role="group" aria-label="Dias da semana">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Semana anterior"
        onClick={(event) => move(-1, event.detail > 0)}
      >
        <ChevronLeft />
      </Button>
      <div
        ref={rail}
        className={styles.weekCarousel}
        onScroll={() => {
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(settle, 140);
        }}
      >
        {[-1, 0, 1].map((offset) => (
          <div
            key={offset}
            className={styles.weekSlide}
            aria-hidden={offset !== 0}
            inert={offset !== 0}
          >
            {Array.from({ length: 7 }, (_unused, index) => shiftDate(from, offset * 7 + index)).map(
              (day) => (
                <button
                  key={day}
                  type="button"
                  className={styles.day}
                  aria-pressed={day === date}
                  aria-current={day === today ? "date" : undefined}
                  onClick={() => onSelectDay(day)}
                  aria-label={calendarDate(day, { weekday: "long", day: "numeric", month: "long" })}
                >
                  <span>{calendarDate(day, { weekday: "short" }).replace(".", "")}</span>{" "}
                  <span>{day.slice(-2)}</span>
                </button>
              ),
            )}
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Próxima semana"
        onClick={(event) => move(1, event.detail > 0)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
