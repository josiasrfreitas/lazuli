"use client";
import type { JSX as ReactJSX } from "react";
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
export function ReasonDialog({
  action,
  row,
  previousId,
  board,
  onClose,
}: {
  action: "withdraw" | "invalidate";
  row: Pick<Placement, "id" | "version" | "studentId" | "studentName">;
  previousId?: string;
  board: SemesterBoard;
  onClose: () => void;
}): ReactJSX.Element {
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
  return (
    <TaskDialog
      title={action === "withdraw" ? "Desfazer publicação" : "Invalidar disponibilidade"}
      description={row.studentName}
      formId="semester-reason"
      firstField="semester-reason-text"
      submitLabel={action === "withdraw" ? "Desfazer publicação" : "Invalidar disponibilidade"}
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="semester-reason"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
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
        }}
      >
        <p className="text-caption text-muted-foreground">
          {action === "withdraw"
            ? "A entrada futura e sua saída de origem serão canceladas juntas. A proposta voltará para preparação."
            : "As propostas que dependem destes horários precisarão de uma nova confirmação."}
        </p>
        <NarrativeField
          name="semester-reason-text"
          label="Motivo"
          placeholder="Explique o que mudou e o próximo encaminhamento"
          value={reason}
          onChange={(value) => {
            setReason(value);
            validation.clear("reason");
          }}
          error={validation.errors.reason}
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
              {query.data?.map((item) => {
                const snapshot = snapshotSchema.safeParse(item.snapshot);
                return (
                  <li key={item.id} className="border-l-2 border-border pl-4">
                    <p className="text-caption font-semibold">
                      {actions[item.action] ?? item.action}
                    </p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      {formatDateOnlyBR(dateOnly(item.createdAt))} ·{" "}
                      {item.recordedBy?.name ?? "Sistema"} · versão {item.version}
                    </p>
                    {snapshot.success && snapshot.data.mode && (
                      <p className="mt-2 text-caption">{modes[snapshot.data.mode]}</p>
                    )}
                    {item.reason && <p className="mt-2 text-caption">{item.reason}</p>}
                    {snapshot.success && snapshot.data.notes && (
                      <p className="mt-2 text-caption text-muted-foreground">
                        {snapshot.data.notes}
                      </p>
                    )}
                  </li>
                );
              })}
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
