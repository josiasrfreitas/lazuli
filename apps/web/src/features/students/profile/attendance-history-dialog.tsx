"use client";

import { useId, useState, type ReactElement } from "react";
import { ListChecks } from "lucide-react";
import {
  Button,
  DataTable,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  InlineSkeleton,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { attendanceHistoryColumns, type AttendanceHistory } from "./attendance-history-columns";

type Props = {
  studentId: string;
  studentName: string;
  enrollmentId?: string | undefined;
  triggerLabel?: string;
};
type AttendanceFilter = keyof AttendanceHistory["counts"];
const FILTER_LABELS: Record<AttendanceFilter, string> = {
  ALL: "Todas as aulas",
  PRESENT: "Presenças",
  ABSENT: "Faltas",
  PENDING: "Sem chamada ou registro",
  CANCELLED: "Aulas canceladas",
};

export function AttendanceHistoryDialog({
  triggerLabel = "Ver aulas e presenças",
  ...props
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="link" size="inline" />}>
        <ListChecks aria-hidden="true" />
        {triggerLabel}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Histórico de frequência</DialogTitle>
            <DialogDescription>
              {props.studentName} · Aulas, presenças e reposições
            </DialogDescription>
          </DialogHeader>
          <AttendanceHistoryContent {...props} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function AttendanceHistoryContent({ studentId, enrollmentId }: Props): ReactElement {
  const fieldId = useId();
  const [selectedEnrollment, setSelectedEnrollment] = useState(enrollmentId ?? "all");
  const [status, setStatus] = useState<AttendanceFilter>("ALL");
  const [page, setPage] = useState(1);
  const query = trpc.students.attendanceHistory.useQuery(
    {
      id: studentId,
      ...(selectedEnrollment === "all" ? {} : { enrollmentId: selectedEnrollment }),
      status,
      page,
    },
    { retry: false, placeholderData: (previous) => previous },
  );
  const data = query.data;
  const enrollmentChoices = [
    { value: "all", label: "Todas as matrículas" },
    ...(data
      ? data.enrollments.map((row) => ({
          value: row.id,
          label: `${row.semester} · ${row.className} · ${formatDateOnlyBR(row.entryDate)}`,
        }))
      : enrollmentId
        ? [{ value: enrollmentId, label: "Matrícula atual" }]
        : []),
  ];
  return (
    <DialogBody className="flex flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pt-5">
        <AttendanceSummary data={query.isError ? undefined : data} loading={query.isPending} />
        <div className="flex shrink-0 items-end gap-3">
          <div className="w-96 max-w-full">
            <SelectControl
              name={`${fieldId}-enrollment`}
              label="Matrícula · turma · entrada"
              value={selectedEnrollment}
              choices={enrollmentChoices}
              onChange={(value) => {
                setSelectedEnrollment(value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-64">
            <SelectControl
              name={`${fieldId}-status`}
              label="Presença"
              value={status}
              choices={Object.entries(FILTER_LABELS).map(([value, label]) => ({
                value,
                label: data ? `${label} (${data.counts[value as AttendanceFilter]})` : label,
              }))}
              onChange={(value) => {
                setStatus(value as AttendanceFilter);
                setPage(1);
              }}
            />
          </div>
          <p className="ml-auto pb-2 text-right text-caption text-muted-foreground">
            Mais recentes primeiro
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-1">
          <DataTable
            label="Aulas e presenças do aluno"
            columns={attendanceHistoryColumns}
            state={
              query.isError
                ? { kind: "error" }
                : !data
                  ? { kind: "loading" }
                  : data.rows.length
                    ? { kind: "data", rows: data.rows }
                    : status === "ALL"
                      ? { kind: "empty" }
                      : { kind: "noResults" }
            }
            updating={query.isFetching}
            onRetry={() => void query.refetch()}
            empty={{
              title: "Nenhuma aula neste período",
              description: "O histórico mostra as aulas até hoje, durante a matrícula do aluno.",
            }}
            errorTitle="Não foi possível carregar a frequência"
            pagination={
              data
                ? {
                    page: data.page,
                    pageSize: data.pageSize,
                    pageCount: data.pageCount,
                    totalItems: data.totalItems,
                    onPageChange: setPage,
                    itemLabel: { singular: "aula", plural: "aulas" },
                  }
                : {
                    loading: true,
                    page,
                    pageSize: 10,
                    itemLabel: { singular: "aula", plural: "aulas" },
                  }
            }
          />
        </div>
        <p className="shrink-0 pb-1 text-caption text-muted-foreground">
          {data && `Aulas até ${formatDateOnlyBR(data.today)}. `}A frequência considera chamadas
          confirmadas e minutos de reposições realizadas. A falta original permanece no histórico.
        </p>
      </div>
    </DialogBody>
  );
}

function AttendanceSummary({
  data,
  loading,
}: {
  data: AttendanceHistory | undefined;
  loading: boolean;
}): ReactElement {
  const stats = [
    {
      label: "Frequência",
      value: data ? formatAttendancePercent(data.attendance.percent) : undefined,
    },
    { label: "Presenças", value: data?.counts.PRESENT },
    { label: "Faltas", value: data?.counts.ABSENT },
    { label: "Minutos repostos", value: data?.attendance.compensatedMinutes },
  ];
  return (
    <dl className="flex shrink-0 items-center gap-8 border-y border-border bg-accent px-4 py-3">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-2">
          <dt className="order-2 text-caption text-muted-foreground">{stat.label}</dt>
          <dd className="order-1 font-numeric text-xl font-semibold tabular-nums text-heading">
            {loading ? <InlineSkeleton className="w-8" /> : (stat.value ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
