"use client";

import { useRef, useState, type ReactElement } from "react";
import { ListTodo, PanelRightOpen, Pin, PinOff } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { AccommodationQueue } from "./queue";
import { queueData } from "./queue-model";
import type { QueueProps } from "./queue-details";
import styles from "./pending-rail.module.css";

export function PendingRail({
  mobileOpen,
  ...props
}: QueueProps & { mobileOpen: boolean }): ReactElement {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = mobileOpen || pinned || hovered || focused;
  const { count } = queueData(props.board);

  function dismiss(): void {
    trigger.current?.focus();
    setPinned(false);
    setHovered(false);
    setFocused(false);
  }

  return (
    <div className={styles.slot} data-pinned={pinned} data-mobile-open={mobileOpen}>
      <aside
        className={styles.drawer}
        data-open={open}
        aria-label="Pendências da organização"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={(event) => {
          if (event.target.matches(":focus-visible")) setFocused(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !mobileOpen) dismiss();
        }}
      >
        <header className={styles.header}>
          <div className={styles.heading} hidden={!open}>
            <ListTodo size={18} aria-hidden="true" />
            <h2>Pendências</h2>
            <Badge variant={count ? "warning" : "neutral"}>{count}</Badge>
          </div>
          <div className={styles.pin}>
            <Button
              ref={trigger}
              size="icon-compact-responsive"
              variant={pinned ? "secondary" : "ghost"}
              aria-label={pinned ? "Desafixar pendências" : "Fixar pendências abertas"}
              aria-pressed={pinned}
              aria-expanded={open}
              aria-controls="organization-pending-content"
              onClick={() => setPinned(!pinned)}
            >
              {open ? (
                pinned ? (
                  <PinOff aria-hidden="true" />
                ) : (
                  <Pin aria-hidden="true" />
                )
              ) : (
                <PanelRightOpen aria-hidden="true" />
              )}
            </Button>
          </div>
        </header>
        <button
          type="button"
          className={styles.summary}
          hidden={open}
          aria-label={`Abrir ${count} pendências da organização`}
          onClick={() => setPinned(true)}
        >
          <ListTodo size={19} aria-hidden="true" />
          <Badge variant={count ? "warning" : "neutral"}>{count}</Badge>
          <span>Pendências</span>
        </button>
        <div id="organization-pending-content" className={styles.content} hidden={!open}>
          <p className={styles.hint}>
            Saídas e trocas primeiro. Depois, confirmações e novas turmas.
          </p>
          <AccommodationQueue
            {...props}
            onSelect={(id) => {
              props.onSelect(id);
              dismiss();
            }}
          />
        </div>
      </aside>
    </div>
  );
}
