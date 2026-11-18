"use client";
import type { ReactElement, ReactNode, MouseEvent } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import type { StaffRole } from "@lazuli/auth/server";
import { navBreadcrumbFor, navReturnFor } from "./nav-items";
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

export function AppBreadcrumb({ role }: AppBreadcrumbInput): ReactNode {
  const pathname = usePathname();
  const params = useSearchParams();
  const breadcrumb = navBreadcrumbFor(pathname, role);
  const parent = navReturnFor({ pathname, role, back: params.get(BACK_QUERY_PARAMETER) });

  if (breadcrumb === null) {
    return null;
  }

  if (parent)
    return (
      <ReturnBreadcrumb
        parent={parent}
        page={pathname === "/turmas/formacao" ? "Formação de turmas" : "Detalhes"}
      />
    );
  if (
    pathname === "/aulas" &&
    params.get("visao") === "academico" &&
    (params.get("mes") || (params.get("agenda") === "true" && params.get("data")))
  ) {
    return <AcademicCalendarBreadcrumb params={params} />;
  }
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-caption">
        <li className="hidden text-muted-foreground sm:block">{breadcrumb.section}</li>
        <li aria-hidden="true" className="hidden text-border-strong sm:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="min-w-0 truncate font-semibold text-foreground">
          {breadcrumbLabel({ pathname, params, page: breadcrumb.page })}
        </li>
      </ol>
    </nav>
  );
}

type AppBreadcrumbInput = { role: StaffRole };

const BACK_QUERY_PARAMETER = "voltar";

function useCalendarBreadcrumb(params: ReadonlyURLSearchParams): CalendarBreadcrumbModel {
  const [, setCalendarLocation] = useQueryStates(
    {
      ano: parseAsInteger,
      mes: parseAsInteger,
      data: parseAsString,
      agenda: parseAsBoolean,
      periodo: parseAsString,
    },
    { history: "push" },
  );
  const { year, month } = calendarCoordinates(params);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const daily = calendarDailyDate(params);
  const returnYear = year;
  const href = `/aulas?visao=academico&ano=${returnYear}${daily ? `&mes=${month}` : ""}`;
  const parent = daily ? monthLabel : `Calendário acadêmico · ${year}`;
  function onClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    void setCalendarLocation({
      ano: returnYear,
      periodo: null,
      mes: daily ? month : null,
      data: null,
      agenda: null,
    });
  }
  return { href, parent, daily, monthLabel, onClick };
}

type CalendarBreadcrumbModel = {
  href: string;
  parent: string;
  daily: string | false | null;
  monthLabel: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};
function AcademicCalendarBreadcrumb({ params }: { params: ReadonlyURLSearchParams }): ReactElement {
  const { href, parent, daily, monthLabel, onClick } = useCalendarBreadcrumb(params);
  return (
    <nav aria-label="Navegação do calendário" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-caption">
        <li className="shrink-0 sm:shrink">
          <Link
            href={href}
            scroll={false}
            prefetch={false}
            onClick={onClick}
            aria-label={`Voltar para ${parent}`}
            className="flex min-h-11 items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
          >
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{parent}</span>
          </Link>
        </li>
        <li aria-hidden="true" className="hidden text-border-strong sm:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="min-w-0 truncate font-semibold text-foreground">
          {daily ? `Dia ${Number(daily.slice(-DAY_LENGTH))}` : monthLabel}
        </li>
      </ol>
    </nav>
  );
}

type ReturnBreadcrumbProps = {
  page: string;
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
          {props.page}
        </li>
      </ol>
    </nav>
  );
}

function breadcrumbLabel({
  pathname,
  params,
  page,
}: {
  pathname: string;
  params: ReadonlyURLSearchParams;
  page: string;
}): string {
  if (pathname !== "/aulas") return page;
  return params.get("visao") === "academico" ? "Calendário Acadêmico" : "Agenda de Aulas";
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MONTHS_PER_YEAR = 12;
const MONTH_START = 5;
const MONTH_END = 7;
const DAY_LENGTH = 2;

function calendarCoordinates(params: ReadonlyURLSearchParams): { year: number; month: number } {
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date()),
  );
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(params.get("ano")) || currentYear));
  const month = Math.min(
    MONTHS_PER_YEAR,
    Math.max(
      1,
      Number(params.get("mes") ?? params.get("data")?.slice(MONTH_START, MONTH_END)) || 1,
    ),
  );
  return { year, month };
}

function calendarDailyDate(params: ReadonlyURLSearchParams): string | false | null {
  return params.get("agenda") === "true" && params.get("data");
}
