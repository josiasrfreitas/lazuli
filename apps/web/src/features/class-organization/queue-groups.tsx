import type { JSX as ReactJSX } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { isPending, stageLabel, type PendingGroup, type Placement } from "./model";
import { PendingLead, PendingStudent, type QueueProps } from "./queue-details";
import { matchesSearch } from "./queue-model";
import styles from "./organization.module.css";

type Lead = QueueProps["board"]["waitingLeads"][number];

export function QueueGroup({
  group,
  board,
  search,
  ended,
  onAction,
  onSelect,
}: QueueProps & {
  group: PendingGroup;
  search: string;
  ended: boolean;
}): ReactJSX.Element | null {
  const rows = group.rows
    .filter((item) => matchesSearch(item.studentName, search))
    .toSorted(
      (left, right) =>
        Number(right.continuity === "LEAVING") - Number(left.continuity === "LEAVING"),
    );
  const leads = group.leads.filter((item) => matchesSearch(item.fullName, search));
  if (rows.length === 0 && leads.length === 0) return null;
  return (
    <section aria-label={`Pendências · ${stageLabel(group.stageCode)}`}>
      <QueueGroupHeader group={group} ended={ended} onAction={onAction} />
      {rows.map((row) => (
        <QueueStudent
          key={row.id}
          row={row}
          board={board}
          ended={ended}
          onAction={onAction}
          onSelect={onSelect}
        />
      ))}
      {leads.map((lead) => (
        <QueueLead key={lead.id} lead={lead} board={board} onSelect={onSelect} />
      ))}
    </section>
  );
}

function QueueGroupHeader({
  group,
  ended,
  onAction,
}: {
  group: PendingGroup;
  ended: boolean;
  onAction: QueueProps["onAction"];
}): ReactJSX.Element {
  const allocationGroup = { ...group, rows: group.rows.filter((row) => isPending(row)) };
  const available = allocationGroup.rows.length + group.leads.length;
  return (
    <div className={styles.groupHeader}>
      <h3>
        {stageLabel(group.stageCode)}{" "}
        <span className={styles.small}>· {group.rows.length + group.leads.length}</span>
      </h3>
      {group.stageId && available >= 2 && (
        <Button
          size="sm"
          variant="ghost"
          disabled={ended}
          onClick={() => onAction({ kind: "plan", group: allocationGroup })}
        >
          Formar turma
        </Button>
      )}
    </div>
  );
}

function QueueStudent({
  row,
  board,
  ended,
  onAction,
  onSelect,
}: QueueProps & { row: Placement; ended: boolean }): ReactJSX.Element {
  const leaving = row.continuity === "LEAVING" || Boolean(row.declinedAt);
  const reason = row.continuityReason || row.declinedReason || row.notes;
  return (
    <details className={styles.queueEntry} data-attention={leaving}>
      <summary className={styles.queueItem}>
        <span className={styles.person}>
          <strong>{row.studentName}</strong>
          <span className={styles.queueMeta}>
            <Badge variant="neutral">Aluno da escola</Badge>
            <span className={leaving ? styles.attention : styles.small}>
              {studentStatus(row, leaving)}
            </span>
          </span>
          {reason && <span className={styles.queuePreview}>{reason}</span>}
        </span>
        <ChevronDown size={14} />
      </summary>
      {leaving ? (
        <LeavingStudent
          row={row}
          reason={reason}
          ended={ended}
          onAction={onAction}
          onSelect={onSelect}
        />
      ) : (
        <PendingStudent row={row} board={board} onAction={onAction} onSelect={onSelect} />
      )}
    </details>
  );
}

function studentStatus(row: Placement, leaving: boolean): string {
  if (leaving) return "Possível saída";
  if (row.continuity === "CHANGE") return "Troca de turma";
  return row.planId ? "Alocação a confirmar" : "Aguardando turma";
}

function LeavingStudent({
  row,
  reason,
  ended,
  onAction,
  onSelect,
}: Pick<QueueProps, "onAction" | "onSelect"> & {
  row: Placement;
  reason: string | null;
  ended: boolean;
}): ReactJSX.Element {
  return (
    <div className={styles.detail}>
      {reason && <p className="text-caption">{reason}</p>}
      {row.sourceClassName && <p className={styles.small}>Turma atual: {row.sourceClassName}</p>}
      <Button size="sm" disabled={ended} onClick={() => onAction({ kind: "continuity", row })}>
        Revisar continuidade
      </Button>
      {row.planId && (
        <Button size="sm" variant="ghost" onClick={() => onSelect(row.planId)}>
          Ver turma
        </Button>
      )}
    </div>
  );
}

function QueueLead({
  lead,
  board,
  onSelect,
}: Pick<QueueProps, "board" | "onSelect"> & { lead: Lead }): ReactJSX.Element {
  return (
    <details className={styles.queueEntry}>
      <summary className={styles.queueItem}>
        <span className={styles.person}>
          <strong>{lead.fullName}</strong>
          <span className={styles.queueMeta}>
            <Badge variant="info">Lead</Badge>
            <span className={styles.small}>
              {lead.allocationPlan ? "Turma proposta" : "Aguardando turma"}
            </span>
          </span>
          {lead.allocationPendingReason && (
            <span className={styles.queuePreview}>{lead.allocationPendingReason}</span>
          )}
        </span>
        <ChevronDown size={14} />
      </summary>
      <PendingLead lead={lead} board={board} onSelect={onSelect} />
    </details>
  );
}
