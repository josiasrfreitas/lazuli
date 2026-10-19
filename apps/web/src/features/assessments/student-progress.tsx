"use client";
import { useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  Alert,
  Button,
  InlineSkeleton,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import { AssessmentSummary, AssessmentStatusBadge } from "./assessment-summary";
import { AssessmentResults } from "./results-table";
import type { Assessment } from "./shared";

export function StudentAcademicProgress({
  studentId,
  studentName,
  initialProgressId,
}: {
  studentId: string;
  studentName: string;
  initialProgressId?: string | undefined;
}): ReactElement {
  const query = trpc.assessments.student.useQuery({ studentId });
  const [selected, setSelected] = useState(initialProgressId ?? "");
  const rows = query.data ?? [];
  const active =
    rows.find((row) => row.progressId === selected) ?? rows.find((row) => row.current) ?? rows[0];
  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <DialogTitle>
            {active ? `Avaliações · ${active.stage.name}` : "Avaliações do estágio"}
          </DialogTitle>
          {active && <AssessmentStatusBadge data={active} />}
        </div>
        <DialogDescription>
          {studentName}
          {active && ` · ${active.stage.track.name} · Desde ${formatDateOnlyBR(active.startedOn)}`}
        </DialogDescription>
      </DialogHeader>
      <AssessmentDialogBody>
        <StudentAssessmentBody
          pending={query.isPending}
          error={query.isError}
          active={active}
          rows={rows}
          onRetry={() => void query.refetch()}
          onSelect={setSelected}
        />
      </AssessmentDialogBody>
    </>
  );
}

function AssessmentDialogBody({ children }: { children: ReactNode }): ReactElement {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    const body = viewport.current;
    const inner = content.current;
    if (!body || !inner) return;
    // CSS layout can round the intrinsic content height up by one pixel.
    const measure = (): void => setScrollable(body.scrollHeight - body.clientHeight > 1);
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(inner);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <DialogBody
      ref={viewport}
      className={`flex-auto ${scrollable ? "overflow-y-auto" : "overflow-y-hidden"}`}
    >
      <div ref={content} className="min-w-0 pt-5">
        {children}
      </div>
    </DialogBody>
  );
}

function StudentAssessmentBody({
  pending,
  error,
  active,
  rows,
  onRetry,
  onSelect,
}: {
  pending: boolean;
  error: boolean;
  active: Assessment | undefined;
  rows: Assessment[];
  onRetry: () => void;
  onSelect: (value: string) => void;
}): ReactElement {
  if (pending)
    return (
      <div role="status" aria-label="Carregando avaliações" className="grid min-w-0 gap-4">
        <InlineSkeleton className="h-8 w-32 rounded-md" />
        <div className="grid gap-2" aria-hidden="true">
          <h3 className="text-sm font-medium text-heading">Evolução das notas</h3>
          <div className="flex h-60 flex-col justify-between border-b border-l border-border p-4">
            {[0, 1, 2, 3].map((row) => (
              <InlineSkeleton key={row} className="h-px w-full rounded-none" />
            ))}
          </div>
          <div className="flex justify-around">
            <InlineSkeleton className="w-16" />
            <InlineSkeleton className="w-16" />
          </div>
        </div>
        <AssessmentResults />
      </div>
    );
  if (error)
    return (
      <Alert variant="destructive">
        Não foi possível carregar as avaliações.
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!active)
    return (
      <p className="text-sm text-muted-foreground">
        As avaliações ficam disponíveis quando o aluno inicia um estágio.
      </p>
    );
  return (
    <AssessmentSummary
      key={active.progressId}
      data={active}
      showHeading={false}
      selector={<StageSelector rows={rows} active={active} onChange={onSelect} />}
    />
  );
}

function StageSelector({
  rows,
  active,
  onChange,
}: {
  rows: Assessment[];
  active: Assessment;
  onChange: (value: string) => void;
}): ReactElement | null {
  const id = useId();
  if (rows.length < 2) return null;
  return (
    <div className="w-full sm:w-60">
      <SelectControl
        name={`${id}-academic-journey`}
        label="Estágio avaliado"
        value={active.progressId}
        onChange={onChange}
        choices={rows.map((row) => ({
          value: row.progressId,
          label: `${row.stage.name} · ${formatDateOnlyBR(row.startedOn)}`,
        }))}
      />
    </div>
  );
}
