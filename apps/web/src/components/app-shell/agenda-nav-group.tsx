"use client";

import { useEffect, useId, useState } from "react";
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
  const Icon = item.icon;
  useEffect(() => {
    if (active) setOpen(true);
  }, [active, academic]);
  return (
    <div className={styles.group} data-mobile={mobile}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-label={item.label}
        data-active={active}
        onClick={() => setOpen(!open)}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </button>
      <div id={id} hidden={!open} className={styles.children}>
        {item.children?.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
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
  );
}
