"use client";

import { useEffect, useId, useState, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./nav-items";
import styles from "./agenda-nav-group.module.css";

export function AgendaNavGroup({
  item,
  pathname,
  mobile = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const query = useSearchParams();
  const academic = query.get("visao") === "academico";
  const active = pathname === item.href;
  const [open, setOpen] = useState(active);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const contents = useRef<HTMLDivElement>(null);
  const [instant, setInstant] = useState(false);
  useLayoutEffect(() => {
    const element = panel.current;
    const inner = contents.current;
    if (!element || !inner) return;
    const resize = () => {
      element.style.height = open ? `${inner.getBoundingClientRect().height}px` : "0px";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [open]);
  const Icon = item.icon;
  useEffect(() => {
    if (active) setOpen(true);
  }, [active, academic]);
  return (
    <div className={styles.group} data-mobile={mobile} data-instant={instant}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-label={item.label}
        data-active={active}
        onClick={(event) => {
          setInstant(event.detail === 0);
          setOpen(!open);
        }}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </button>
      <div
        id={id}
        ref={panel}
        className={styles.panel}
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
        <div ref={contents} className={styles.contents}>
          <div className={styles.children}>
            {item.children?.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => onNavigate?.()}
                aria-current={
                  active && academic === child.href.includes("visao=academico") ? "page" : undefined
                }
              >
                <child.icon aria-hidden="true" />
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
