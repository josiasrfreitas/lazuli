"use client";
import type { ReactElement } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { AnalyticsSections } from "../finance-analytics/analytics-sections";
import { QueryNotice } from "../finance-analytics/query-notice";
import { demoPeriods, demoToday } from "./demo";
import { Choices, LayoutContext, Picker } from "./controls";
import { periodLabel, type Period } from "./model";
import { RetentionSection } from "./retention";
import { IndicatorsSection } from "./indicators";
import { DemandSection } from "./demand";
import styles from "./pedagogical.module.css";
const sections = {
  permanencia: "Permanência",
  indicadores: "Indicadores pedagógicos",
  espera: "Espera e PPT",
};
export function PedagogicalAnalytics(): ReactElement {
  const search = useSearchParams();
  const demo = search.get("demo") === "1";
  const incoming = search.get("secao") ?? "";
  const section = Object.hasOwn(sections, incoming) ? incoming : "permanencia";
  const [layout, setLayout] = useState<"overview" | "history" | "detail">("overview");
  return (
    <div className={styles.page} data-layout={demo ? layout : "overview"}>
      <header className={styles.heading}>
        <h1>Analytics pedagógicos</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("demo", demo ? "" : "1")}>
          {demo ? "Voltar aos dados da escola" : "Ver demonstração"}
        </Button>
      </header>
      {demo && (
        <aside className={styles.demo}>
          <strong>Dados de demonstração</strong>
          <Choices
            label="Composição da demonstração"
            value={layout}
            change={setLayout}
            choices={{
              overview: "Visão geral",
              history: "Gráfico primeiro",
              detail: "Detalhe aberto",
            }}
          />
        </aside>
      )}
      <AnalyticsSections
        active={section}
        sections={sections}
        setActive={(value) => navigate("secao", value)}
      />
      <LayoutContext.Provider value={demo ? layout : "overview"}>
        <Report demo={demo} section={section} expanded={demo && layout === "detail"} />
      </LayoutContext.Provider>
    </div>
  );
}
function navigate(key: string, value: string): void {
  const url = new URL(globalThis.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  globalThis.history.pushState(null, "", url);
}
type ReportProps = { demo: boolean; expanded: boolean; section: string };
function Report({ demo, section, expanded }: ReportProps): ReactElement {
  const [requested, setRequested] = useState("");
  const query = trpc.dashboard.pedagogicalPeriods.useQuery(undefined, { enabled: !demo });
  const result = demo ? { periods: demoPeriods, today: demoToday } : query.data;
  if (!result) return <QueryNotice failed={query.isError} retry={() => void query.refetch()} />;
  const { periods: catalog, today } = result;
  const periods = section === "permanencia" ? catalog.filter((term) => term.previous) : catalog;
  const period = periods.find((term) => term.id === requested) ?? periods[0];
  return (
    <>
      {period && (
        <div className={styles.period}>
          <Picker
            label={section === "permanencia" ? "Virada acadêmica" : "Período acadêmico"}
            value={period.id}
            options={periods.map((term) => ({
              id: term.id,
              label: section === "permanencia" ? periodLabel(term) : term.period,
            }))}
            change={setRequested}
          />
          <span>
            {formatDateOnlyBR(period.start)} a {formatDateOnlyBR(period.end)}
          </span>
        </div>
      )}
      <Subject
        demo={demo}
        expanded={expanded}
        section={section}
        period={period}
        periods={periods}
        today={today}
        select={setRequested}
      />
    </>
  );
}
function Subject({
  demo,
  expanded,
  section,
  period,
  periods,
  today,
  select,
}: ReportProps & {
  period: Period | undefined;
  periods: Period[];
  today: string;
  select: (id: string) => void;
}): ReactElement {
  if (section === "espera")
    return <DemandSection demo={demo} period={period} today={today} expanded={expanded} />;
  if (!period)
    return (
      <p>
        {section === "permanencia"
          ? "A primeira virada estará disponível quando houver dois semestres cadastrados e iniciados."
          : `Nenhum período acadêmico iniciado até ${formatDateOnlyBR(today)}.`}
      </p>
    );
  if (section === "permanencia")
    return (
      <RetentionSection
        period={period}
        periods={periods}
        select={select}
        today={today}
        demo={demo}
        expanded={expanded}
      />
    );
  return <IndicatorsSection period={period} demo={demo} expanded={expanded} />;
}
