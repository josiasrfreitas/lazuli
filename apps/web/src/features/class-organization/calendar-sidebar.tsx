"use client";

import type { JSX as ReactJSX } from "react";
import { CalendarDays, Download, Plus } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationAction, OrganizationBoard } from "./model";
import styles from "./organization.module.css";

export function CalendarSidebar({
  board,
  start,
  end,
  onAction,
}: {
  board: OrganizationBoard;
  start: string;
  end: string;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const remove = trpc.calendar.removeClosedDay.useMutation({ onSuccess: refresh });
  return (
    <aside className={styles.panel}>
      <CalendarSidebarHeader start={start} end={end} onAction={onAction} />
      <div className={styles.selection}>
        <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "closure" })}>
          <Plus size={14} />
          Dia ou intervalo
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "holidays" })}>
          <Download size={14} />
          Feriados
        </Button>
      </div>
      {remove.error && (
        <div className={styles.error} role="alert">
          {remove.error.message}
        </div>
      )}
      <ClosedDaysList
        board={board}
        removing={remove.isPending}
        onRemove={(date) => remove.mutate({ date })}
      />
    </aside>
  );
}

function CalendarSidebarHeader({
  start,
  end,
  onAction,
}: {
  start: string;
  end: string;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  return (
    <header className={styles.panelHeader}>
      <h2>Datas que organizam o período</h2>
      <dl className={styles.facts}>
        <dt>Início</dt>
        <dd>{formatDateOnlyBR(start)}</dd>
        <dt>Encerramento</dt>
        <dd>{formatDateOnlyBR(end)}</dd>
      </dl>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "period" })}>
          <CalendarDays size={14} />
          Editar período
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "newSemester" })}>
          Novo período
        </Button>
      </div>
    </header>
  );
}

function ClosedDaysList({
  board,
  removing,
  onRemove,
}: {
  board: OrganizationBoard;
  removing: boolean;
  onRemove: (date: string) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.scroll}>
      {board.closedDays.map((day) => (
        <div className={styles.closedRow} key={day.id}>
          <div className={styles.row}>
            <strong className="text-caption">{formatDateOnlyBR(dateOnly(day.date))}</strong>
            <Button
              size="sm"
              variant="ghost"
              disabled={removing}
              aria-label={`Remover ${day.reason} de ${formatDateOnlyBR(dateOnly(day.date))}`}
              onClick={() => onRemove(dateOnly(day.date))}
            >
              Remover
            </Button>
          </div>
          <span className={styles.small}>{day.reason}</span>
        </div>
      ))}
      {board.closedDays.length === 0 && (
        <div className={styles.detail}>
          <p className={styles.small}>
            Nenhuma exceção registrada. Importe os feriados nacionais e acrescente as datas de
            Lagarto, férias e recessos da escola.
          </p>
        </div>
      )}
    </div>
  );
}
