"use client";

import Link from "next/link";
import { useId, useState, type ReactElement } from "react";
import { ArrowUpRight, ListChecks } from "lucide-react";
import {
  Button,
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
import type { AttendanceHistory } from "./attendance-history-columns";
import { AttendanceHistoryList } from "./attendance-history-list";

type Props = {
  studentId: string;
  studentName: string;
  enrollmentId?: string | undefined;
  triggerLabel?: string;
  triggerValue?: string | undefined;
};
type AttendanceFilter = keyof AttendanceHistory["counts"];
const FILTER_LABELS: Record<AttendanceFilter, string> = {
  ALL: "Todas as aulas",
  PRESENT: "Presenças",
  ABSENT: "Faltas",
  PENDING: "Sem chamada ou registro",
  CANCELLED: "Aulas canceladas",
};
const ALL_ENROLLMENTS_LABEL = "Todas as matrículas";

export function AttendanceHistoryDialog({
  triggerLabel = "Ver aulas e presenças",
  triggerValue,
  ...props
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AttendanceHistoryTrigger
        triggerLabel={triggerLabel}
        triggerValue={triggerValue}
        studentName={props.studentName}
      />
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="min-h-128 md:max-w-3xl" data-student-dialog-motion>
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

function AttendanceHistoryTrigger({
  triggerLabel,
  triggerValue,
  studentName,
}: Pick<Props, "triggerLabel" | "triggerValue" | "studentName">): ReactElement {
  return (
    <DialogTrigger
      render={
        triggerValue === undefined ? (
          <Button
            variant="link"
            size="inline"
            className="[--interactive:var(--brand-link)] [--interactive-hover:var(--brand-link-hover)] [--interactive-active:var(--brand-link-active)]"
            aria-label={`${triggerLabel} de ${studentName}`}
          />
        ) : (
          <button
            type="button"
            className="inline-flex min-h-8 cursor-pointer items-center justify-end gap-1 rounded-sm font-numeric tabular-nums text-foreground transition-colors hover:text-interactive focus-visible:outline-none focus-visible:shadow-focus"
            aria-label={`${triggerLabel} de ${studentName}`}
            title={triggerLabel}
          />
        )
      }
    >
      {triggerValue === undefined ? (
        <>
          <ListChecks aria-hidden="true" />
          {triggerLabel}
        </>
      ) : (
        <>
          {triggerValue}
          <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </>
      )}
    </DialogTrigger>
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
  return (
    <DialogBody className="flex flex-auto flex-col">
      <div className="flex min-w-0 flex-col gap-3 pt-3">
        <AttendanceSummary data={query.isError ? undefined : data} loading={query.isPending} />
        <AttendanceHistoryFilters
          fieldId={fieldId}
          data={data}
          enrollmentId={enrollmentId}
          selectedEnrollment={selectedEnrollment}
          status={status}
          onEnrollmentChange={(value) => {
            setSelectedEnrollment(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <AttendanceClassButton
          data={data}
          selectedEnrollment={selectedEnrollment}
          studentId={studentId}
        />
        <AttendanceHistoryList
          data={data}
          error={query.isError}
          fetching={query.isFetching}
          status={status}
          onPageChange={setPage}
          onRetry={() => void query.refetch()}
        />
        <AttendanceHistoryNote data={data} />
      </div>
    </DialogBody>
  );
}

function AttendanceHistoryNote({ data }: { data: AttendanceHistory | undefined }): ReactElement {
  return (
    <p className="shrink-0 pb-1 text-caption text-muted-foreground">
      {data && `Aulas até ${formatDateOnlyBR(data.today)}. `}A frequência considera chamadas
      confirmadas e minutos de reposições realizadas. A falta original permanece no histórico.
    </p>
  );
}

function enrollmentChoices(
  data: AttendanceHistory | undefined,
  enrollmentId: string | undefined,
): {
  value: string;
  label: string;
}[] {
  if (data)
    return [
      { value: "all", label: ALL_ENROLLMENTS_LABEL },
      ...data.enrollments.map((row) => ({
        value: row.id,
        label: `${row.semester} · ${row.className} · ${formatDateOnlyBR(row.entryDate)}`,
      })),
    ];
  if (enrollmentId)
    return [
      { value: "all", label: ALL_ENROLLMENTS_LABEL },
      { value: enrollmentId, label: "Matrícula atual" },
    ];
  return [{ value: "all", label: ALL_ENROLLMENTS_LABEL }];
}

function AttendanceHistoryFilters({
  fieldId,
  data,
  enrollmentId,
  selectedEnrollment,
  status,
  onEnrollmentChange,
  onStatusChange,
}: {
  fieldId: string;
  data: AttendanceHistory | undefined;
  enrollmentId: string | undefined;
  selectedEnrollment: string;
  status: AttendanceFilter;
  onEnrollmentChange: (value: string) => void;
  onStatusChange: (value: AttendanceFilter) => void;
}): ReactElement {
  return (
    <div className="flex shrink-0 flex-wrap items-end gap-3">
      {(data?.enrollments.length ?? 0) > 1 && (
        <div className="w-96 max-w-full">
          <SelectControl
            name={`${fieldId}-enrollment`}
            label="Matrícula · turma · entrada"
            value={selectedEnrollment}
            choices={enrollmentChoices(data, enrollmentId)}
            onChange={onEnrollmentChange}
          />
        </div>
      )}
      <div className="w-64 max-w-full">
        <SelectControl
          name={`${fieldId}-status`}
          label="Presença"
          value={status}
          choices={Object.entries(FILTER_LABELS).map(([value, label]) => ({
            value,
            label: data ? `${label} (${data.counts[value as AttendanceFilter]})` : label,
          }))}
          onChange={(value) => onStatusChange(value as AttendanceFilter)}
        />
      </div>
      <p className="ml-auto pb-2 text-right text-caption text-muted-foreground">
        Mais recentes primeiro
      </p>
    </div>
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
    <dl className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-2 border-y border-border py-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-caption text-muted-foreground">{stat.label}</dt>
          <dd className="font-numeric text-xl font-semibold tabular-nums text-heading">
            {loading ? <InlineSkeleton className="w-8" /> : (stat.value ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AttendanceClassButton({
  data,
  selectedEnrollment,
  studentId,
}: {
  data: AttendanceHistory | undefined;
  selectedEnrollment: string;
  studentId: string;
}): ReactElement | null {
  const enrollment =
    data?.enrollments.find((row) => row.id === selectedEnrollment) ??
    (data?.enrollments.length === 1 ? data.enrollments[0] : undefined);
  if (!enrollment) return null;
  return (
    <div className="flex justify-start">
      <Button
        variant="secondary"
        size="sm"
        nativeButton={false}
        render={
          <Link
            href={`/turmas/${enrollment.classId}?voltar=${encodeURIComponent(`/alunos/${studentId}`)}`}
          />
        }
      >
        Ver turma <ArrowUpRight aria-hidden="true" />
      </Button>
    </div>
  );
}
