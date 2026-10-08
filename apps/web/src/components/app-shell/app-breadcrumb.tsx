"use client";
import type { ReactElement, ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { StaffRole } from "@lazuli/auth/server";
import { safeTeacherReturn } from "~/features/teachers/format";
import { navBreadcrumbFor, navReturnFor, type NavBreadcrumb } from "./nav-items";

export function AppBreadcrumb({ role }: AppBreadcrumbInput): ReactNode {
  const pathname = usePathname();
  const params = useSearchParams();
  const breadcrumb = navBreadcrumbFor(pathname, role);
  const parent = navReturnFor({ pathname, role, back: params.get(BACK_QUERY_PARAMETER) });

  if (breadcrumb === null) {
    return null;
  }

  const teacherDetail = pathname.startsWith(TEACHER_DETAIL_PREFIX);
  const returnHref = breadcrumbReturn({
    pathname,
    back: params.get(BACK_QUERY_PARAMETER),
    parentHref: parent?.href,
  });

  if (parent)
    return (
      <ReturnBreadcrumb
        returnHref={returnHref}
        parent={parent}
        teacherDetail={teacherDetail}
        breadcrumb={breadcrumb}
      />
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

type AppBreadcrumbInput = { role: StaffRole };

function breadcrumbReturn({
  pathname,
  back,
  parentHref,
}: BreadcrumbReturnInput): string | undefined {
  const teacherDetail = pathname.startsWith(TEACHER_DETAIL_PREFIX);
  const teacherReturn = pathname.startsWith("/turmas/") && back?.startsWith(TEACHER_DETAIL_PREFIX);
  return teacherDetail || teacherReturn ? safeTeacherReturn(back) : parentHref;
}

const BACK_QUERY_PARAMETER = "voltar";

type BreadcrumbReturnInput = {
  pathname: string;
  back: string | null;
  parentHref: string | undefined;
};

type ReturnBreadcrumbProps = {
  returnHref: string | undefined;
  parent: { href: string; label: string };
  teacherDetail: boolean;
  breadcrumb: NavBreadcrumb;
};
function ReturnBreadcrumb(props: ReturnBreadcrumbProps): ReactElement {
  return (
    <nav aria-label="Navegação da página">
      <ol className="flex items-center gap-3 text-caption">
        <li>
          <Link
            href={props.returnHref ?? props.parent.href}
            aria-label={`Voltar para ${props.parent.label}`}
            className="flex min-h-11 items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {props.teacherDetail ? props.breadcrumb.section : props.parent.label}
          </Link>
        </li>
        <li aria-hidden="true" className="text-border-strong">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="font-semibold">
          {props.teacherDetail ? props.breadcrumb.page : "Detalhes"}
        </li>
      </ol>
    </nav>
  );
}

const TEACHER_DETAIL_PREFIX = "/professores/";
