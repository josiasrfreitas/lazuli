import { PERCENT_SCALE } from "./model";
import type { ReactElement } from "react";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { AnalyticsRecords } from "../finance-analytics/analytics-records";
import { QueryNotice } from "../finance-analytics/query-notice";
import { ChartLayout, ChartPanel, Picker } from "./controls";
import { demoDemand } from "./demo";
import type { Demand, Period } from "./model";
import styles from "./pedagogical.module.css";

export function DemandSection({
  demo,
  period,
  today,
  expanded,
}: {
  demo: boolean;
  period: Period | undefined;
  today: string;
  expanded: boolean;
}): ReactElement {
  const query = trpc.dashboard.pedagogicalDemand.useQuery(period ? { periodId: period.id } : {}, {
    enabled: !demo,
  });
  const [stage, setStage] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const rows: Demand[] | undefined = demo ? demoDemand(period) : query.data?.rows;
  if (!rows) return <QueryNotice failed={query.isError} retry={() => void query.refetch()} />;
  const active = rows.find((row) => row.id === stage) ?? rows[0];
  if (!active)
    return (
      <ChartPanel title="Fila regular e PPT">
        <p>
          Nenhum caso na fila de {formatDateOnlyBR(today)} ou com entrada em PPT vinculada a uma
          alocação no período.
        </p>
      </ChartPanel>
    );
  const decisionKey = `${period?.id}/${active.id}`;
  const reason = reasons[decisionKey] ?? "unknown";
  return (
    <>
      <div className={styles.controls}>
        <Picker label="Estágio" value={active.id} options={rows} change={setStage} />
      </div>
      <ChartLayout>
        <QueuePanel rows={rows} active={active} today={today} setStage={setStage} />
        <PptPanel
          demo={demo}
          active={active}
          period={period}
          reason={reason}
          setReason={(reason) => setReasons({ ...reasons, [decisionKey]: reason })}
        />
        <DemandDetail rows={rows} period={period} expanded={expanded} />
      </ChartLayout>
    </>
  );
}
function QueuePanel({
  rows,
  active,
  today,
  setStage,
}: {
  rows: Demand[];
  active: Demand;
  today: string;
  setStage: (id: string) => void;
}): ReactElement {
  const max = Math.max(1, ...rows.map((row) => row.waiting));
  return (
    <ChartPanel
      title="Fila regular por estágio"
      note={`Pessoas aguardando alocação em ${formatDateOnlyBR(today)}`}
    >
      <div className={styles.bars} data-series="regular">
        {rows.map((row) => (
          <button key={row.id} aria-pressed={active.id === row.id} onClick={() => setStage(row.id)}>
            <span>{row.label}</span>
            <strong>{row.waiting}</strong>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
              <rect width="100" height="4" fill="var(--analytics-regular-surface)" />
              <rect
                width={(PERCENT_SCALE * row.waiting) / max}
                height="4"
                fill="var(--analytics-regular)"
              />
            </svg>
          </button>
        ))}
      </div>
      <p>
        A fila reflete a posição atual. {active.unspecified} em {active.label} aguardam com
        modalidade a definir.
      </p>
    </ChartPanel>
  );
}
function reasonCounts(
  active: Demand,
  reason: string,
): { attributed: number; direct: number; unknown: number } {
  const attributed = (active.regularReferral ?? 0) + Number(reason === "regular");
  const direct = (active.direct ?? 0) + Number(reason === "direct");
  return { attributed, direct, unknown: active.ppt - attributed - direct };
}
function PptPanel({
  active,
  period,
  demo,
  reason,
  setReason,
}: {
  active: Demand;
  period: Period | undefined;
  demo: boolean;
  reason: string;
  setReason: (reason: string) => void;
}): ReactElement {
  const { attributed, direct, unknown } = reasonCounts(active, reason);
  return (
    <ChartPanel
      title={demo ? "Encaminhamentos ao PPT" : "Entradas em PPT"}
      note={`${active.label} · ${period?.period ?? "sem período acadêmico"}`}
    >
      <PptTotal active={active} demo={demo} period={period} />
      {period && (
        <div className={styles.breakdown}>
          <div>
            <span>Procura por turma regular</span>
            <strong>{demo ? attributed : "Sem registro"}</strong>
          </div>
          <div>
            <span>Escolha direta por PPT</span>
            <strong>{demo ? direct : "Sem registro"}</strong>
          </div>
          <div>
            <span>Motivo não informado</span>
            <strong>{unknown}</strong>
          </div>
        </div>
      )}
      {!demo && (
        <p>
          O histórico disponível registra a entrada na turma. A data do encaminhamento e o motivo da
          escolha ainda não estão disponíveis.
        </p>
      )}
      {demo && <DemoReason active={active} reason={reason} setReason={setReason} />}
    </ChartPanel>
  );
}
function PptTotal({
  active,
  demo,
  period,
}: {
  active: Demand;
  demo: boolean;
  period: Period | undefined;
}): ReactElement {
  return (
    <div className={styles.ppt}>
      <strong>{period ? active.ppt : "—"}</strong>
      <p>
        {demo
          ? "pessoas encaminhadas durante o semestre"
          : "pessoas com alocação vinculada à matrícula no período"}
      </p>
    </div>
  );
}
function DemoReason({
  active,
  reason,
  setReason,
}: {
  active: Demand;
  reason: string;
  setReason: (value: string) => void;
}): ReactElement | null {
  if (active.ppt <= (active.regularReferral ?? 0) + (active.direct ?? 0)) return null;
  return (
    <label className={styles.field}>
      Motivo de um encaminhamento da demonstração
      <select value={reason} onChange={(event) => setReason(event.target.value)}>
        <option value="unknown">Ainda não sabemos</option>
        <option value="regular">Procura por turma regular</option>
        <option value="direct">Escolha direta por PPT</option>
      </select>
    </label>
  );
}
function DemandDetail({
  rows,
  period,
  expanded,
}: {
  rows: Demand[];
  period: Period | undefined;
  expanded: boolean;
}): ReactElement {
  return (
    <details className={styles.detail} key={String(expanded)} open={expanded}>
      <summary>Conferir números por estágio</summary>
      <AnalyticsRecords
        label="Fila atual e entradas no período"
        rows={rows}
        columns={[
          { id: "stage", header: "Estágio", cell: (row) => row.label },
          {
            id: "waiting",
            header: "Fila regular hoje",
            numeric: true,
            cell: (row) => row.waiting,
          },
          {
            id: "ppt",
            header: `PPT · ${period?.period ?? "sem período"}`,
            numeric: true,
            cell: (row) => (period ? row.ppt : "—"),
          },
        ]}
      />
    </details>
  );
}
