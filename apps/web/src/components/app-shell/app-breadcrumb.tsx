"use client";

import type { ReactNode } from "react";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { StaffRole } from "@lazuli/auth/server";

import { navBreadcrumbFor, navReturnFor } from "./nav-items";

export function AppBreadcrumb({ role }: { role: StaffRole }): ReactNode {
  const pathname = usePathname();
  const params = useSearchParams();
  const breadcrumb = navBreadcrumbFor(pathname, role);
  const parent = navReturnFor({ pathname, role, back: params.get("voltar") });

  if (breadcrumb === null) {
    return null;
  }

  if (parent)
    return (
      <nav aria-label="Navegação da página">
        <ol className="flex items-center gap-3 text-caption">
          <li>
            <Link
              href={parent.href}
              aria-label={`Voltar para ${parent.label}`}
              className="flex min-h-11 items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {parent.label}
            </Link>
          </li>
          <li aria-hidden="true" className="text-border-strong">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="font-semibold">
            Detalhes
          </li>
        </ol>
      </nav>
    );
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
