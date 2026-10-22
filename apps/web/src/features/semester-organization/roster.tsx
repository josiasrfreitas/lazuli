"use client";
import type { Dispatch, FormEventHandler, JSX as ReactJSX, SetStateAction } from "react";
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
type RosterSelection = {
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
  selectAll: (value: boolean) => void;
  confirm: boolean;
  setConfirm: Dispatch<SetStateAction<boolean>>;
  clear: () => void;
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
}): ReactJSX.Element {
  const selection = useRosterSelection({ rows, plan, readOnly });
  const { ready, selected, select, confirm, setConfirm } = selection;
  return (
    <div className="grid min-w-0 gap-4">
      <RosterToolbar
        rowsCount={rows.length}
        readyCount={ready.length}
        selectedCount={selected.length}
        canPublish={Boolean(plan && !readOnly)}
        onPublish={() => setConfirm(true)}
      />
      <RosterDesktop rows={rows} readOnly={readOnly} onAction={onAction} selection={selection} />
      <RosterMobile
        rows={rows}
        ready={ready}
        selected={selected}
        select={select}
        readOnly={readOnly}
        onAction={onAction}
      />
      {confirm && plan && (
        <PublishDialog
          board={board}
          plan={plan}
          rows={rows}
          selected={selected}
          onClose={() => setConfirm(false)}
          onPublished={selection.clear}
        />
      )}
    </div>
  );
}

function useRosterSelection({
  rows,
  plan,
  readOnly,
}: {
  rows: Placement[];
  plan: ClassPlan | undefined;
  readOnly: boolean;
}): RosterSelection {
  const [selection, setSelection] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const ready = rows.filter(
    (row) => !row.publishedAt && row.blockers.length === 0 && !readOnly && plan,
  );
  const selected = ready.filter((row) => selection.includes(row.id));
  const select = (row: Placement, value: boolean): void =>
    setSelection((current) =>
      value ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id),
    );
  const selectAll = (value: boolean): void => setSelection(value ? ready.map((row) => row.id) : []);
  const clear = (): void => {
    setConfirm(false);
    setSelection([]);
  };
  return { ready, selected, select, selectAll, confirm, setConfirm, clear };
}

function RosterDesktop({
  rows,
  readOnly,
  onAction,
  selection,
}: {
  rows: Placement[];
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
  selection: RosterSelection;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const columns = rosterColumns({
    ready: selection.ready,
    selected: selection.selected,
    select: selection.select,
    selectAll: selection.selectAll,
    readOnly,
    onAction,
  });
  return (
    <div className="hidden min-w-0 sm:block">
      <DataTable
        label="Propostas de alunos para o próximo semestre"
        columns={columns}
        state={rows.length > 0 ? { kind: "data", rows } : { kind: "empty" }}
        onRetry={() => void refresh()}
        empty={{
          title: "Organize os primeiros alunos",
          description: "Na aba Alunos a organizar, escolha quem deve estudar nesta turma.",
        }}
        errorTitle="Não foi possível carregar as propostas"
      />
    </div>
  );
}

function PublishDialog({
  board,
  plan,
  rows,
  selected,
  onClose,
  onPublished,
}: {
  board: SemesterBoard;
  plan: ClassPlan;
  rows: Placement[];
  selected: Placement[];
  onClose: () => void;
  onPublished: () => void;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.publish.useMutation({
    onSuccess: async () => {
      onPublished();
      await refresh();
    },
  });
  return (
    <TaskDialog
      title={`Publicar ${selected.length} ${selected.length === 1 ? "aluno" : "alunos"}`}
      description={plan.name}
      formId="semester-publish"
      firstField="semester-publish-submit"
      submitLabel="Confirmar publicação"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message}
    >
      <PublishForm
        board={board}
        rows={rows}
        selected={selected}
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending && selected.length > 0)
            mutation.mutate({
              planId: plan.id,
              version: plan.version,
              placements: selected.map((row) => ({ id: row.id, version: row.version })),
            });
        }}
      />
    </TaskDialog>
  );
}

function PublishForm({
  board,
  rows,
  selected,
  onSubmit,
}: {
  board: SemesterBoard;
  rows: Placement[];
  selected: Placement[];
  onSubmit: FormEventHandler<HTMLFormElement>;
}): ReactJSX.Element {
  return (
    <form id="semester-publish" noValidate className="grid gap-4 pt-4" onSubmit={onSubmit}>
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
        {rows.filter((row) => !row.publishedAt).length - selected.length} propostas permanecem em
        preparação. As informações serão conferidas novamente ao publicar.
      </Alert>
    </form>
  );
}

function RosterToolbar({
  rowsCount,
  readyCount,
  selectedCount,
  canPublish,
  onPublish,
}: {
  rowsCount: number;
  readyCount: number;
  selectedCount: number;
  canPublish: boolean;
  onPublish: () => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption text-muted-foreground">
        {rowsCount} {rowsCount === 1 ? "proposta" : "propostas"} · {readyCount}{" "}
        {readyCount === 1 ? "pronta" : "prontas"} para publicar
      </p>
      {canPublish && (
        <Button disabled={selectedCount === 0} onClick={onPublish}>
          <Check />
          Publicar selecionados{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
      )}
    </div>
  );
}

function RosterMobile({
  rows,
  ready,
  selected,
  select,
  readOnly,
  onAction,
}: {
  rows: Placement[];
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}): ReactJSX.Element {
  return (
    <div className="grid gap-3 sm:hidden">
      {rows.map((row) => (
        <RosterMobileCard
          key={row.id}
          row={row}
          ready={ready}
          selected={selected}
          select={select}
          readOnly={readOnly}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function RosterMobileCard({
  row,
  ready,
  selected,
  select,
  readOnly,
  onAction,
}: {
  row: Placement;
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}): ReactJSX.Element {
  return (
    <article className="grid gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <SelectionCell row={row} ready={ready} selected={selected} select={select} />
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
  );
}

function rosterColumns({
  ready,
  selected,
  select,
  selectAll,
  readOnly,
  onAction,
}: {
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
  selectAll: (value: boolean) => void;
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}): DataTableColumn<Placement>[] {
  return [
    selectionColumn({ ready, selected, select, selectAll }),
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
}

function selectionColumn({
  ready,
  selected,
  select,
  selectAll,
}: {
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
  selectAll: (value: boolean) => void;
}): DataTableColumn<Placement> {
  return {
    id: "selection",
    width: "selection",
    header: <SelectionHeader ready={ready} selected={selected} onSelectAll={selectAll} />,
    cell: (row) => <SelectionCell row={row} ready={ready} selected={selected} select={select} />,
  };
}

function SelectionHeader({
  ready,
  selected,
  onSelectAll,
}: {
  ready: Placement[];
  selected: Placement[];
  onSelectAll: (value: boolean) => void;
}): ReactJSX.Element {
  return (
    <Checkbox
      aria-label="Selecionar alunos prontos"
      checked={ready.length > 0 && selected.length === ready.length}
      indeterminate={selected.length > 0 && selected.length < ready.length}
      disabled={ready.length === 0}
      onCheckedChange={onSelectAll}
    />
  );
}

function SelectionCell({
  row,
  ready,
  selected,
  select,
}: {
  row: Placement;
  ready: Placement[];
  selected: Placement[];
  select: (row: Placement, value: boolean) => void;
}): ReactJSX.Element {
  return (
    <Checkbox
      aria-label={`Selecionar ${row.studentName}`}
      disabled={!ready.some((item) => item.id === row.id)}
      checked={selected.some((item) => item.id === row.id)}
      onCheckedChange={(value) => select(row, value)}
    />
  );
}
function StudentCell({ row }: { row: Placement }): ReactJSX.Element {
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
}): ReactJSX.Element {
  const availability = row.availability;
  let label = "Confirmar horários";
  if (availability?.confirmed) label = `Até ${formatDateOnlyBR(dateOnly(availability.validUntil))}`;
  else if (availability) label = "Confirmar novamente";
  return (
    <div className="grid justify-items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Disponibilidade de ${row.studentName}`}
        disabled={readOnly}
        onClick={onClick}
      >
        {label}
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
function Readiness({ row }: { row: Placement }): ReactJSX.Element {
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
}): ReactJSX.Element {
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
        <RowActionItems row={row} readOnly={readOnly} onAction={onAction} />
      </PopoverContent>
    </Popover>
  );
}

function RowActionItems({
  row,
  readOnly,
  onAction,
}: {
  row: Placement;
  readOnly: boolean;
  onAction: (action: PlacementAction) => void;
}): ReactJSX.Element {
  return (
    <div className="mt-3 grid justify-items-start gap-2">
      {!readOnly && !row.publishedAt && (
        <RowActionButton
          row={row}
          kind="edit"
          label="Revisar proposta"
          variant="secondary"
          onAction={onAction}
        />
      )}
      <RowActionButton
        row={row}
        kind="history"
        label="Histórico da proposta"
        variant="ghost"
        onAction={onAction}
      />
      {!readOnly && row.publishedAt && (
        <RowActionButton
          row={row}
          kind="withdraw"
          label="Desfazer publicação"
          variant="ghost"
          onAction={onAction}
        />
      )}
      {row.notes && <p className="text-caption text-muted-foreground">{row.notes}</p>}
    </div>
  );
}

function RowActionButton({
  row,
  kind,
  label,
  variant,
  onAction,
}: {
  row: Placement;
  kind: PlacementAction["kind"];
  label: string;
  variant: "secondary" | "ghost";
  onAction: (action: PlacementAction) => void;
}): ReactJSX.Element {
  return (
    <PopoverClose
      render={<Button variant={variant} size="sm" onClick={() => onAction({ kind, row })} />}
    >
      {label}
    </PopoverClose>
  );
}
