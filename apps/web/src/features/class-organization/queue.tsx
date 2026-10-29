"use client";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { Badge, Button } from "@lazuli/ui";
import type { QueueProps } from "./queue-details";
import { QueueGroup, QueueStudent } from "./queue-groups";
import { dateOnly } from "~/features/class-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { queueData } from "./queue-model";
import styles from "./organization.module.css";

export function AccommodationQueue(props: QueueProps): ReactElement {
  const { board, onSelect, onAction } = props;
  const ended = dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  const { urgent, unassigned, confirmations, waiting, leadGroups, count } = queueData(board);
  return (
    <div className={styles.queueContent}>
      <div className={styles.scroll}>
        <PendingSection title="Conversar primeiro" count={urgent.length}>
          {urgent.map((row) => (
            <QueueStudent key={row.id} {...props} row={row} ended={ended} />
          ))}
        </PendingSection>
        <PendingSection title="Alunos sem turma" count={unassigned.length}>
          {unassigned.map((row) => (
            <QueueStudent key={row.id} {...props} row={row} ended={ended} />
          ))}
        </PendingSection>
        <PendingSection
          title="Confirmar continuidade"
          count={confirmations.reduce((sum, item) => sum + item.pending, 0)}
        >
          {confirmations.map(({ plan, pending }) => (
            <button
              key={plan.id}
              type="button"
              className={styles.queueItem}
              onClick={() => onSelect(plan.id)}
            >
              <span className={styles.person}>
                <strong>{plan.name}</strong>
                <span className={styles.small}>
                  {pending} {pending === 1 ? "aluno a confirmar" : "alunos a confirmar"}
                </span>
              </span>
              <span className="text-caption text-interactive">Abrir</span>
            </button>
          ))}
        </PendingSection>
        <PendingSection title="Leads aguardando turma" count={waiting.length}>
          {leadGroups.map(([key, group]) => (
            <QueueGroup key={key} group={group} {...props} search="" ended={ended} />
          ))}
        </PendingSection>
        {!count && (
          <div className={styles.empty}>
            <h3>Nenhuma pendência</h3>
            <p>As confirmações e os interessados de cada turma estão na sua expansão.</p>
          </div>
        )}
      </div>
      <footer className={styles.selection}>
        <Button
          size="sm"
          variant="secondary"
          disabled={ended}
          onClick={() => onAction({ kind: "findStudent" })}
        >
          Incluir aluno existente
        </Button>
        <Link className="text-caption text-interactive" href="/interessados">
          Cadastrar lead
        </Link>
      </footer>
    </div>
  );
}

function PendingSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}): ReactElement | null {
  if (!count) return null;
  return (
    <section aria-label={title}>
      <div className={styles.groupHeader}>
        <h3>{title}</h3>
        <Badge variant="neutral">{count}</Badge>
      </div>
      {children}
    </section>
  );
}
