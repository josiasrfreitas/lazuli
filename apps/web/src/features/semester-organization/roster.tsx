"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, MoreHorizontal } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  DataTable,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
  PopoverClose,
  type DataTableColumn,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog } from "~/features/shared/task-form";
import {
  dateOnly,
  modes,
  PlacementBadge,
  useOrganizationRefresh,
  type Placement,
  type ClassPlan,
  type SemesterBoard,
} from "./shared";
export type PlacementAction = {
  kind: "edit" | "availability" | "history" | "withdraw";
  row: Placement;
};
export function SemesterRoster({
  board,
  plan,
  rows,
  readOnly,
  onAction,
}: {
  board: SemesterBoard;
  plan?: ClassPlan | undefined;
  rows: Placement[];
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const refresh = useOrganizationRefresh();
  const ready = rows.filter((row) => !row.publishedAt && !row.blockers.length && !readOnly && plan);
  const selected = ready.filter((row) => selection.includes(row.id));
  const mutation = trpc.semesterOrganization.publish.useMutation({
    onSuccess: async () => {
      setConfirm(false);
      setSelection([]);
      await refresh();
    },
  });
  const select = (row: Placement, value: boolean) =>
    setSelection((current) =>
      value ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id),
    );
  const columns: DataTableColumn<Placement>[] = [
    {
      id: "selection",
      header: (
        <Checkbox
          aria-label="Selecionar alunos prontos"
          checked={ready.length > 0 && selected.length === ready.length}
          indeterminate={selected.length > 0 && selected.length < ready.length}
          disabled={!ready.length}
          onCheckedChange={(value) => setSelection(value ? ready.map((row) => row.id) : [])}
        />
      ),
      width: "selection",
      cell: (row) => (
        <Checkbox
          aria-label={`Selecionar ${row.studentName}`}
          disabled={!ready.some((item) => item.id === row.id)}
          checked={selected.some((item) => item.id === row.id)}
          onCheckedChange={(value) => select(row, value)}
        />
      ),
    },
    {
      id: "student",
      header: "Aluno / próxima etapa",
      width: "wide",
      cell: (row) => <StudentCell row={row} />,
    },
    {
      id: "availability",
      header: "Disponibilidade",
      width: "medium",
      cell: (row) => (
        <AvailabilityCell
          row={row}
          readOnly={readOnly}
          onClick={() => onAction({ kind: "availability", row })}
        />
      ),
    },
    {
      id: "readiness",
      header: "Publicação",
      width: "wide",
      cell: (row) => <Readiness row={row} />,
    },
    {
      id: "actions",
      header: "",
      width: "selection",
      cell: (row) => <RowActions row={row} readOnly={readOnly} onAction={onAction} />,
    },
  ];
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">
          {rows.length} {rows.length === 1 ? "proposta" : "propostas"} · {ready.length}{" "}
          {ready.length === 1 ? "pronta" : "prontas"} para publicar
        </p>
        {plan && !readOnly && (
          <Button disabled={!selected.length} onClick={() => setConfirm(true)}>
            <Check />
            Publicar selecionados{selected.length ? ` (${selected.length})` : ""}
          </Button>
        )}
      </div>
      <div className="hidden min-w-0 sm:block">
        <DataTable
          label="Propostas de alunos para o próximo semestre"
          columns={columns}
          state={rows.length ? { kind: "data", rows } : { kind: "empty" }}
          onRetry={() => void refresh()}
          empty={{
            title: "Organize os primeiros alunos",
            description: "Na aba Alunos a organizar, escolha quem deve estudar nesta turma.",
          }}
          errorTitle="Não foi possível carregar as propostas"
        />
      </div>
      <div className="grid gap-3 sm:hidden">
        {rows.map((row) => (
          <article key={row.id} className="grid gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <Checkbox
                  aria-label={`Selecionar ${row.studentName}`}
                  disabled={!ready.some((item) => item.id === row.id)}
                  checked={selected.some((item) => item.id === row.id)}
                  onCheckedChange={(value) => select(row, value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <StudentCell row={row} />
              </div>
              <RowActions row={row} readOnly={readOnly} onAction={onAction} />
            </div>
            <Readiness row={row} />
            <div className="border-t border-border pt-3">
              <AvailabilityCell
                row={row}
                readOnly={readOnly}
                onClick={() => onAction({ kind: "availability", row })}
              />
            </div>
          </article>
        ))}
      </div>
      {confirm && plan && (
        <TaskDialog
          title={`Publicar ${selected.length} ${selected.length === 1 ? "aluno" : "alunos"}`}
          description={plan.name}
          formId="semester-publish"
          firstField="semester-publish-submit"
          submitLabel="Confirmar publicação"
          onClose={() => setConfirm(false)}
          pending={mutation.isPending}
          error={mutation.error?.message}
        >
          <form
            id="semester-publish"
            noValidate
            className="grid gap-4 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!mutation.isPending && selected.length)
                mutation.mutate({
                  planId: plan.id,
                  version: plan.version,
                  placements: selected.map((row) => ({ id: row.id, version: row.version })),
                });
            }}
          >
            <p className="text-caption">
              Entrada em <strong>{formatDateOnlyBR(dateOnly(board.semester.startDate))}</strong>. As
              matrículas de origem continuam até essa data.
            </p>
            <ul className="grid gap-2 text-caption">
              {selected.map((row) => (
                <li key={row.id}>
                  {row.studentName} · {row.stageCode}
                </li>
              ))}
            </ul>
            <Alert>
              {rows.filter((row) => !row.publishedAt).length - selected.length} propostas permanecem
              em preparação. As informações serão conferidas novamente ao publicar.
            </Alert>
          </form>
        </TaskDialog>
      )}
    </div>
  );
}
function StudentCell({ row }: { row: Placement }) {
  return (
    <div className="grid gap-1">
      <Link
        className="text-caption font-semibold text-heading hover:underline"
        href={`/alunos/${row.studentId}`}
      >
        {row.studentName}
      </Link>
      <span className="text-caption text-muted-foreground">
        {row.sourceStageCode ? `${row.sourceStageCode} → ` : ""}
        {row.stageCode ?? "Estágio a definir"} · {modes[row.mode]}
      </span>
      {row.sourceClassName && (
        <span className="text-micro text-muted-foreground">{row.sourceClassName}</span>
      )}
    </div>
  );
}
function AvailabilityCell({
  row,
  readOnly,
  onClick,
}: {
  row: Placement;
  readOnly: boolean;
  onClick: () => void;
}) {
  const availability = row.availability;
  return (
    <div className="grid justify-items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Disponibilidade de ${row.studentName}`}
        disabled={readOnly}
        onClick={onClick}
      >
        {availability?.confirmed
          ? `Até ${formatDateOnlyBR(dateOnly(availability.validUntil))}`
          : availability
            ? "Confirmar novamente"
            : "Confirmar horários"}
        <ArrowUpRight />
      </Button>
      {availability && (
        <span className="text-micro text-muted-foreground">
          {availability.recordedBy} · {formatDateOnlyBR(dateOnly(availability.confirmedAt))}
        </span>
      )}
    </div>
  );
}
function Readiness({ row }: { row: Placement }) {
  return (
    <div className="grid justify-items-start gap-1.5">
      <PlacementBadge row={row} />
      {row.blockers.slice(0, 2).map((blocker) => (
        <p key={blocker} className="text-caption text-muted-foreground">
          {blocker}
        </p>
      ))}
      {row.blockers.length > 2 && (
        <details>
          <summary className="cursor-pointer text-caption text-interactive">
            Mais {row.blockers.length - 2} pendências
          </summary>
          <ul className="mt-1 grid gap-1">
            {row.blockers.slice(2).map((blocker) => (
              <li key={blocker} className="text-caption text-muted-foreground">
                {blocker}
              </li>
            ))}
          </ul>
        </details>
      )}
      {row.publishedAt && (
        <span className="text-micro text-muted-foreground">
          {formatDateOnlyBR(dateOnly(row.publishedAt))} · {row.publishedBy}
        </span>
      )}
    </div>
  );
}
function RowActions({
  row,
  readOnly,
  onAction,
}: {
  row: Placement;
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label={`Ações de ${row.studentName}`} />
        }
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverTitle>{row.studentName}</PopoverTitle>
        <div className="mt-3 grid justify-items-start gap-2">
          {!readOnly && !row.publishedAt && (
            <PopoverClose
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAction({ kind: "edit", row })}
                />
              }
            >
              Revisar proposta
            </PopoverClose>
          )}
          <PopoverClose
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction({ kind: "history", row })}
              />
            }
          >
            Histórico da proposta
          </PopoverClose>
          {!readOnly && row.publishedAt && (
            <PopoverClose
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction({ kind: "withdraw", row })}
                />
              }
            >
              Desfazer publicação
            </PopoverClose>
          )}
          {row.notes && <p className="text-caption text-muted-foreground">{row.notes}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
