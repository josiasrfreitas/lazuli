"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { ChevronRight, UserCheck, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";
import { TeacherListLoading } from "./list-loading";
import { TeacherPlacement } from "./visit-placement";

type Visit = RouterOutputs["teacherWorkspace"]["visit"];
type VisitListRow = RouterOutputs["teacherWorkspace"]["visits"][number];
const titles = {
  PLACEMENT: "Nivelamento",
  INTRODUCTION: "Aula experimental",
  TRIAL: "Experimental na turma",
};

export function TeacherVisits(): ReactJSX.Element {
  const query = trpc.teacherWorkspace.visits.useQuery();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <TeacherPage
      title="Experimentais e nivelamentos"
      description="Encontros e correções atribuídos a você."
      back="/professor"
    >
      <TeacherQueryState
        loading={<TeacherListLoading label="Carregando seus encontros" status />}
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {query.data.map((row) => (
            <VisitListItem key={row.id} row={row} onSelect={setSelected} />
          ))}
          {query.data.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum encontro atribuído.</p>
          )}
        </div>
      )}
      {selected && <TeacherVisitDialog id={selected} onClose={() => setSelected(null)} />}
    </TeacherPage>
  );
}

function VisitListItem({
  row,
  onSelect,
}: {
  row: VisitListRow;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted"
      onClick={() => onSelect(row.id)}
    >
      <span className="min-w-0 flex-1 text-sm font-semibold">
        {row.candidate.fullName}
        <span className="mt-1 block text-caption font-normal text-muted-foreground">
          {titles[row.kind]} · {formatDateOnlyBR(row.date)} · {row.startTime}
        </span>
      </span>
      <Badge
        className="shrink-0"
        variant={row.assessment && !row.assessment.stageId ? "warning" : "neutral"}
      >
        {visitStatus(row)}
      </Badge>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function visitStatus(row: VisitListRow): string {
  if (row.assessment?.stageId) return "Corrigido";
  if (row.assessment) return "Por corrigir";
  if (row.status === "SCHEDULED") return "Agendado";
  if (row.status === "CANCELLED") return "Cancelado";
  return "Registrado";
}

export function TeacherVisitDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}): ReactJSX.Element {
  const query = trpc.teacherWorkspace.visit.useQuery({ id });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="p-4 md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {query.data ? titles[query.data.kind] : "Encontro"}
            </DialogTitle>
            {query.data && <DialogDescription>{query.data.candidate.fullName}</DialogDescription>}
          </DialogHeader>
          <DialogBody className="-mx-4 px-4">
            <TeacherQueryState
              label="Carregando encontro"
              pending={query.isPending}
              error={query.error}
              retry={() => void query.refetch()}
            />
            {query.data && <TeacherVisitBody key={query.data.id} visit={query.data} />}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X aria-hidden="true" />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function TeacherVisitBody({ visit }: { visit: Visit }): ReactJSX.Element {
  const canSaveOutcome = visit.canRecord && (visit.kind !== "PLACEMENT" || !visit.assessment);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 py-3">
      <p className="text-caption text-muted-foreground">
        {formatDateOnlyBR(visit.date)} · {visit.startTime}–{visit.endTime} ·{" "}
        {visit.format === "ONLINE" ? "Online" : "Presencial"}
      </p>
      {visit.kind === "PLACEMENT" && <TeacherPlacement visit={visit} />}
      {canSaveOutcome ? (
        <VisitOutcomeForm visit={visit} />
      ) : (
        visit.notes && <p className="whitespace-pre-wrap text-sm">{visit.notes}</p>
      )}
      {!visit.canRecord && (
        <p className="text-caption text-muted-foreground">
          Registro indisponível: o encontro ainda não começou ou está encerrado para alterações.
        </p>
      )}
    </div>
  );
}

type Outcome = "ATTENDED" | "ABSENT";
function VisitOutcomeForm({ visit }: { visit: Visit }): ReactJSX.Element {
  const [outcome, setOutcome] = useState<Outcome>(
    visit.status === "ABSENT" ? "ABSENT" : "ATTENDED",
  );
  const [notes, setNotes] = useState(visit.notes ?? "");
  const utils = trpc.useUtils();
  const refresh = (): Promise<[void, void]> =>
    Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const save = trpc.teacherWorkspace.visitOutcome.useMutation({ onSuccess: refresh });
  return (
    <form
      className="grid min-w-0 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ id: visit.id, status: outcome, notes });
      }}
    >
      <OutcomeFields outcome={outcome} onOutcome={setOutcome} notes={notes} onNotes={setNotes} />
      {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
      {save.isSuccess && (
        <p role="status" className="text-sm text-success">
          Comparecimento registrado.
        </p>
      )}
      <Button type="submit" size="sm" className="w-fit" disabled={save.isPending}>
        <UserCheck aria-hidden="true" />
        {save.isPending ? "Salvando…" : "Salvar comparecimento"}
      </Button>
    </form>
  );
}

function OutcomeFields({
  outcome,
  onOutcome,
  notes,
  onNotes,
}: {
  outcome: Outcome;
  onOutcome: (value: Outcome) => void;
  notes: string;
  onNotes: (value: string) => void;
}): ReactJSX.Element {
  return (
    <>
      <SegmentedControl
        size="sm"
        wrap
        aria-label="Comparecimento"
        value={outcome}
        onValueChange={(value) => {
          if (value === "ATTENDED" || value === "ABSENT") onOutcome(value);
        }}
      >
        <SegmentedControlItem value="ATTENDED">Compareceu</SegmentedControlItem>
        <SegmentedControlItem value="ABSENT">Não compareceu</SegmentedControlItem>
      </SegmentedControl>
      <label className="grid gap-1 text-caption">
        Registro do encontro
        <Textarea
          size="sm"
          rows={2}
          value={notes}
          maxLength={2000}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="Como foi a participação e o que precisa ser retomado?"
        />
      </label>
    </>
  );
}
