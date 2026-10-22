"use client";
import type { FormEvent, JSX as ReactJSX } from "react";
import { useState } from "react";
import { z, invalidateAvailabilitySchema, withdrawSemesterSchema } from "@lazuli/validators";
import {
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { RecordState } from "~/features/class-records/shared";
import {
  dateOnly,
  modes,
  useOrganizationRefresh,
  type Placement,
  type SemesterBoard,
} from "./shared";
type ReasonProps = {
  action: "withdraw" | "invalidate";
  row: Pick<Placement, "id" | "version" | "studentId" | "studentName">;
  previousId?: string;
  board: SemesterBoard;
  onClose: () => void;
};

type ReasonFormState = {
  reason: string;
  pending: boolean;
  error: string | undefined;
  bodyRef: ReturnType<typeof useValidation>["body"];
  reasonError: string | undefined;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeReason: (value: string) => void;
};

export function ReasonDialog(props: ReasonProps): ReactJSX.Element {
  const form = useReasonForm(props);
  return (
    <ReasonDialogView
      action={props.action}
      studentName={props.row.studentName}
      onClose={props.onClose}
      form={form}
    />
  );
}

function useReasonForm({ action, row, previousId, board, onClose }: ReasonProps): ReasonFormState {
  const [reason, setReason] = useState("");
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const options = {
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  };
  const withdraw = trpc.semesterOrganization.withdraw.useMutation(options);
  const invalidate = trpc.semesterOrganization.invalidateAvailability.useMutation(options);
  const mutation = action === "withdraw" ? withdraw : invalidate;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (action === "withdraw") {
      const values = validation.validate(withdrawSemesterSchema, {
        id: row.id,
        version: row.version,
        reason,
      });
      if (values) withdraw.mutate(values);
    } else {
      const values = validation.validate(invalidateAvailabilitySchema, {
        semesterId: board.semester.id,
        studentId: row.studentId,
        previousId,
        reason,
      });
      if (values) invalidate.mutate(values);
    }
  };
  const changeReason = (value: string): void => {
    setReason(value);
    validation.clear("reason");
  };
  return {
    reason,
    pending: mutation.isPending,
    error: mutation.error?.message,
    bodyRef: validation.body,
    reasonError: validation.errors.reason,
    submit,
    changeReason,
  };
}

function ReasonDialogView({
  action,
  studentName,
  onClose,
  form,
}: {
  action: "withdraw" | "invalidate";
  studentName: string;
  onClose: () => void;
  form: ReasonFormState;
}): ReactJSX.Element {
  return (
    <TaskDialog
      title={action === "withdraw" ? "Desfazer publicação" : "Invalidar disponibilidade"}
      description={studentName}
      formId="semester-reason"
      firstField="semester-reason-text"
      submitLabel={action === "withdraw" ? "Desfazer publicação" : "Invalidar disponibilidade"}
      pending={form.pending}
      onClose={onClose}
      error={form.error}
      bodyRef={form.bodyRef}
    >
      <form id="semester-reason" noValidate className="grid gap-4 pt-4" onSubmit={form.submit}>
        <p className="text-caption text-muted-foreground">
          {action === "withdraw"
            ? "A entrada futura e sua saída de origem serão canceladas juntas. A proposta voltará para preparação."
            : "As propostas que dependem destes horários precisarão de uma nova confirmação."}
        </p>
        <NarrativeField
          name="semester-reason-text"
          label="Motivo"
          placeholder="Explique o que mudou e o próximo encaminhamento"
          value={form.reason}
          onChange={form.changeReason}
          error={form.reasonError}
        />
      </form>
    </TaskDialog>
  );
}
const actions: Record<string, string> = {
  INHERITED: "Continuidade herdada",
  CONTINUITY: "Intenção de continuidade",
  CARRIED_FORWARD: "Pendência trazida do período anterior",
  ENROLLED: "Matrícula confirmada",
  NOT_CONTINUING: "Não continuidade registrada",
  CONFIRMED_CONTINUITY: "Continuidade confirmada",
  PROPOSED: "Proposta criada",
  REVISED: "Proposta revisada",
  PUBLISHED: "Publicação realizada",
  WITHDRAWN: "Publicação desfeita",
  REQUIRES_REVIEW: "Devolvida para revisão",
  REMOVED: "Proposta retirada",
};
const snapshotSchema = z.object({
  mode: z.enum(["ENTRY", "CONTINUE", "ADVANCE", "REPEAT"]).optional(),
  notes: z.string().nullable().optional(),
});
type HistoryItem = RouterOutputs["semesterOrganization"]["history"][number];
export function PlacementHistory({
  row,
  onClose,
}: {
  row: Placement;
  onClose: () => void;
}): ReactJSX.Element {
  const query = trpc.semesterOrganization.history.useQuery({ id: row.id });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico da proposta</DialogTitle>
            <DialogDescription>{row.studentName}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <RecordState
              pending={query.isPending}
              error={query.error}
              retry={() => void query.refetch()}
            />
            <ol className="grid gap-5 py-4">
              {query.data?.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </ol>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Fechar histórico
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function HistoryRow({ item }: { item: HistoryItem }): ReactJSX.Element {
  const snapshot = snapshotSchema.safeParse(item.snapshot);
  return (
    <li className="border-l-2 border-border pl-4">
      <p className="text-caption font-semibold">{actions[item.action] ?? item.action}</p>
      <p className="mt-1 text-caption text-muted-foreground">
        {formatDateOnlyBR(dateOnly(item.createdAt))} · {item.recordedBy?.name ?? "Sistema"} · versão{" "}
        {item.version}
      </p>
      {snapshot.success && snapshot.data.mode && (
        <p className="mt-2 text-caption">{modes[snapshot.data.mode]}</p>
      )}
      {item.reason && <p className="mt-2 text-caption">{item.reason}</p>}
      {snapshot.success && snapshot.data.notes && (
        <p className="mt-2 text-caption text-muted-foreground">{snapshot.data.notes}</p>
      )}
    </li>
  );
}
