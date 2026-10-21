"use client";
import type { JSX as ReactJSX } from "react";
import { Button } from "@lazuli/ui";
import { CalendarDays, Download, Plus } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { OrganizationAction, SemesterBoard } from "./model";
import styles from "./organization.module.css";

const ISO_MONTH_LENGTH = 7;
const CALENDAR_UTC_HOUR = 12;

const ISO_DATE_LENGTH = 10;

export function OrganizationCalendar({
  board,
  onAction,
}: {
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  const start = dateOnly(board.semester.startDate),
    end = dateOnly(board.semester.endDate);
  const refresh = useOrganizationRefresh();
  const remove = trpc.calendar.removeClosedDay.useMutation({ onSuccess: refresh });
  const months: Date[] = [];
  for (
    let date = new Date(`${start.slice(0, ISO_MONTH_LENGTH)}-01T12:00:00Z`);
    date.toISOString().slice(0, ISO_DATE_LENGTH) <= end;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, CALENDAR_UTC_HOUR))
  )
    months.push(date);
  return (
    <div className={styles.workspace}>
      <div className={styles.scroll}>
        <div className={`${styles.row} px-4 pt-3`}>
          <span className={styles.small}>
            Calendário letivo · selecione uma data para registrar uma exceção
          </span>
          <span className={`${styles.small} ${styles.attention}`}>Sublinhado: dia sem aula</span>
        </div>
        <div className={styles.months}>
          {months.map((month) => {
            const count = new Date(
              Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
            ).getUTCDate();
            return (
              <section className={styles.month} key={month.toISOString()}>
                <h3>
                  {new Intl.DateTimeFormat("pt-BR", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(month)}
                </h3>
                <div className={styles.days}>
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((day, position) => (
                    <span key={position}>{day}</span>
                  ))}
                  {Array.from({ length: month.getUTCDay() }, (_unused, position) => (
                    <span key={`empty-${position}`} />
                  ))}
                  {Array.from({ length: count }, (_unused, position) => {
                    const date = `${month.toISOString().slice(0, ISO_MONTH_LENGTH)}-${String(position + 1).padStart(2, "0")}`;
                    const closed = board.closedDays.find((item) => dateOnly(item.date) === date);
                    return (
                      <button
                        type="button"
                        key={date}
                        data-closed={Boolean(closed)}
                        data-boundary={date === start || date === end}
                        data-outside={date < start || date > end}
                        title={`${formatDateOnlyBR(date)}${closed ? ` · ${closed.reason}` : ""}`}
                        aria-label={`${formatDateOnlyBR(date)}${closed ? `, ${closed.reason}` : ", registrar dia sem aula"}`}
                        onClick={() => onAction({ kind: "closure", date })}
                      >
                        {position + 1}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>Datas que organizam o semestre</h2>
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
              Novo semestre
            </Button>
          </div>
        </header>
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
        <div className={styles.scroll}>
          {board.closedDays.map((day) => (
            <div className={styles.closedRow} key={day.id}>
              <div className={styles.row}>
                <strong className="text-caption">{formatDateOnlyBR(dateOnly(day.date))}</strong>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  aria-label={`Remover ${day.reason} de ${formatDateOnlyBR(dateOnly(day.date))}`}
                  onClick={() => remove.mutate({ date: dateOnly(day.date) })}
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
      </aside>
    </div>
  );
}
