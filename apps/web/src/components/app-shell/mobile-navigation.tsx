"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { StaffIdentity } from "@lazuli/auth/server";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import { matchesNavHref, navSectionsFor } from "./nav-items";
import styles from "./mobile-navigation.module.css";

export function MobileNavigation({ identity }: { identity: StaffIdentity }): ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="sm:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-compact-responsive"
              aria-label={open ? "Fechar navegação" : "Abrir navegação"}
              onPointerDown={() => setKeyboard(false)}
              onKeyDown={() => setKeyboard(true)}
            />
          }
        >
          <span className={styles.triggerIcon} data-open={open} data-keyboard={keyboard}>
            <Menu aria-hidden="true" />
            <X aria-hidden="true" />
          </span>
        </PopoverTrigger>
        <PopoverContent
          size="menu"
          motion={keyboard ? "instant" : "unfold"}
          align="start"
          sideOffset={8}
          aria-label="Menu de navegação"
          onKeyDown={(event) => {
            if (event.key === "Escape") setKeyboard(true);
          }}
        >
          <NavigationItems
            role={identity.role}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NavigationItems({
  role,
  pathname,
  onNavigate,
}: {
  role: StaffIdentity["role"];
  pathname: string;
  onNavigate: () => void;
}): ReactElement {
  return (
    <nav aria-label="Navegação principal" className={styles.navigation}>
      {navSectionsFor(role).map((section) => (
        <div key={section.id} className={styles.section}>
          {section.label && <p className={styles.sectionTitle}>{section.label}</p>}
          <div>
            {section.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={styles.link}
                data-menu-item
                aria-current={matchesNavHref({ href, pathname }) ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
