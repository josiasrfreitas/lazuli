"use client";

import type { ReactNode } from "react";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

import type { StaffRole } from "@lazuli/auth/server";

import { navBreadcrumbFor } from "./nav-items";

export function AppBreadcrumb({ role }: { role: StaffRole }): ReactNode {
  const breadcrumb = navBreadcrumbFor(usePathname(), role);

  if (breadcrumb === null) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-caption">
        <li className="text-muted-foreground">{breadcrumb.section}</li>
        <li aria-hidden="true" className="text-border-strong">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="font-semibold text-foreground">
          {breadcrumb.page}
        </li>
      </ol>
    </nav>
  );
}
