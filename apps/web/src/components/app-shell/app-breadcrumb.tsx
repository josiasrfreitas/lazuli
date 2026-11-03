"use client";
import type { ReactElement, ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { StaffRole } from "@lazuli/auth/server";
import { navBreadcrumbFor, navReturnFor } from "./nav-items";

export function AppBreadcrumb({ role }: AppBreadcrumbInput): ReactNode {
  const pathname = usePathname();
  const params = useSearchParams();
  const breadcrumb = navBreadcrumbFor(pathname, role);
  const parent = navReturnFor({ pathname, role, back: params.get(BACK_QUERY_PARAMETER) });

  if (breadcrumb === null) {
    return null;
  }

  if (parent) return <ReturnBreadcrumb parent={parent} />;
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

type AppBreadcrumbInput = { role: StaffRole };

const BACK_QUERY_PARAMETER = "voltar";

type ReturnBreadcrumbProps = {
  parent: { href: string; label: string };
};
function ReturnBreadcrumb(props: ReturnBreadcrumbProps): ReactElement {
  return (
    <nav aria-label="Navegação da página" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-3 text-caption">
        <li className="min-w-0">
          <Link
            href={props.parent.href}
            aria-label={`Voltar para ${props.parent.label}`}
            className="flex min-h-11 items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
          >
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{props.parent.label}</span>
          </Link>
        </li>
        <li aria-hidden="true" className="hidden text-border-strong sm:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="hidden font-semibold sm:block">
          Detalhes
        </li>
      </ol>
    </nav>
  );
}
