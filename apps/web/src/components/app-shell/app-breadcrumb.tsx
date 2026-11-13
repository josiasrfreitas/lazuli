"use client";
import type { ReactElement, ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import type { StaffRole } from "@lazuli/auth/server";
import { navBreadcrumbFor, navReturnFor } from "./nav-items";
import { trpc } from "~/lib/trpc";
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

export function AppBreadcrumb({ role }: AppBreadcrumbInput): ReactNode {
  const pathname = usePathname();
  const params = useSearchParams();
  const breadcrumb = navBreadcrumbFor(pathname, role);
  const parent = navReturnFor({ pathname, role, back: params.get(BACK_QUERY_PARAMETER) });

  if (breadcrumb === null) {
    return null;
  }

  if (parent) return <ReturnBreadcrumb parent={parent} />;
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
          {pathname === "/aulas"
            ? params.get("visao") === "academico"
              ? "Calendário Acadêmico"
              : "Agenda de Aulas"
            : breadcrumb.page}
        </li>
      </ol>
    </nav>
  );
}

type AppBreadcrumbInput = { role: StaffRole };

const BACK_QUERY_PARAMETER = "voltar";

function AcademicCalendarBreadcrumb({ params }: { params: ReadonlyURLSearchParams }) {
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
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date()),
  );
  const year = Math.min(2100, Math.max(2000, Number(params.get("ano")) || currentYear));
  const month = Math.min(
    12,
    Math.max(1, Number(params.get("mes") ?? params.get("data")?.slice(5, 7)) || 1),
  );
  const query = trpc.calendar.academic.year.useQuery({ year }, { staleTime: 30000 });
  const periodId = params.get("periodo");
  const period = query.data?.periods.find((row) => row.id === periodId);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const daily = params.get("agenda") === "true" && params.get("data");
  const returnYear = daily ? year : (period?.startDate.getUTCFullYear() ?? year);
  const href = `/aulas?visao=academico&ano=${returnYear}${periodId ? `&periodo=${encodeURIComponent(periodId)}` : ""}${daily ? `&mes=${month}` : ""}`;
  const parent = daily ? monthLabel : (period?.name ?? "Calendário acadêmico");
  return (
    <nav aria-label="Navegação do calendário" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-caption">
        <li className="shrink-0 sm:shrink">
          <Link
            href={href}
            scroll={false}
            prefetch={false}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              void setCalendarLocation({
                ano: returnYear,
                periodo: periodId,
                mes: daily ? month : null,
                data: null,
                agenda: null,
              });
            }}
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
          {daily ? `Dia ${Number(daily.slice(-2))}` : monthLabel}
        </li>
      </ol>
    </nav>
  );
}

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
