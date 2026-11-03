"use client";
import { useState, type FormEvent } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { z, calendarDateSchema } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useValidation } from "~/features/shared/task-form";
import { dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationDialogProps as Props } from "./dialogs";
import type { Placement, OrganizationBoard } from "./model";

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 1200;
const declineSchema = z.object({
  reason: z.string().trim().min(MIN_REASON_LENGTH, "Informe o motivo.").max(MAX_REASON_LENGTH),
});
const moveSchema = z.object({
  planId: z.string().uuid("Escolha uma turma."),
  effectiveDate: calendarDateSchema,
  reason: z.string().trim().max(MAX_REASON_LENGTH),
});
export type MovementProps = Props & { rows: Placement[]; decline: boolean };
export type MovementModel = {
  targetSemesterId: string;
  targetBoard: OrganizationBoard | undefined;
  targetError: string | undefined;
  periods: QueryResult<RouterOutputs["semesterOrganization"]["semesters"]>;
  planId: string;
  date: string;
  reason: string;
  errors: ReturnType<typeof useValidation>["errors"];
  body: ReturnType<typeof useValidation>["body"];
  pending: boolean;
  error: string | undefined;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeSemester: (id: string) => void;
  changePlan: (id: string) => void;
  changeDate: (value: string) => void;
  changeReason: (value: string) => void;
};

type MovementDraft = Pick<
  MovementModel,
  | "targetSemesterId"
  | "targetBoard"
  | "targetError"
  | "periods"
  | "planId"
  | "date"
  | "reason"
  | "changeSemester"
  | "changePlan"
  | "changeDate"
  | "changeReason"
>;
type MovementSubmission = Pick<MovementModel, "errors" | "body" | "pending" | "error" | "submit">;

export function useMovementModel(props: MovementProps): MovementModel {
  const draft = useMovementDraft(props);
  const submission = useMovementSubmission(props, draft);
  return { ...draft, ...submission };
}

function useMovementDraft({ action, decline, board }: MovementProps): MovementDraft {
  const [targetSemesterId, setTargetSemesterId] = useState(board.semester.id);
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const targetQuery = trpc.semesterOrganization.detail.useQuery(
    { semesterId: targetSemesterId },
    { enabled: !decline && targetSemesterId !== board.semester.id },
  );
  const targetBoard = targetSemesterId === board.semester.id ? board : targetQuery.data;
  const [planId, setPlanId] = useState("planId" in action ? (action.planId ?? "") : "");
  const [date, setDate] = useState(
    formatDateOnlyBR(
      [dateOnly(board.semester.startDate), toDateOnlySaoPaulo(new Date())].toSorted().at(-1),
    ),
  );
  const [reason, setReason] = useState("");
  const changeSemester = (id: string): void => {
    setTargetSemesterId(id);
    setPlanId("");
    const period = periods.data?.find((item) => item.id === id);
    if (period)
      setDate(
        formatDateOnlyBR(
          [dateOnly(period.startDate), toDateOnlySaoPaulo(new Date())].toSorted().at(-1),
        ),
      );
  };
  return {
    targetSemesterId,
    targetBoard,
    targetError: targetQuery.error?.message,
    periods,
    planId,
    date,
    reason,
    changeSemester,
    changePlan: setPlanId,
    changeDate: (value) => setDate(maskDateBR(value)),
    changeReason: setReason,
  };
}

function useMovementSubmission(
  { rows, decline, board, onClose }: MovementProps,
  draft: MovementDraft,
): MovementSubmission {
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const options = {
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  };
  const move = trpc.semesterOrganization.move.useMutation(options);
  const stop = trpc.semesterOrganization.decline.useMutation(options);
  const mutation = decline ? stop : move;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (mutation.isPending) return;
    const selections = rows.map(({ id, version }) => ({ id, version }));
    const semesterId = board.semester.id;
    if (decline) {
      const values = validation.validate(declineSchema, { reason: draft.reason });
      if (values) stop.mutate({ semesterId, selections, ...values });
      return;
    }
    const values = validation.validate(moveSchema, {
      planId: draft.planId,
      effectiveDate: parseDateBR(draft.date) ?? "",
      reason: draft.reason,
    });
    if (values)
      move.mutate({
        semesterId,
        selections,
        ...values,
        targetSemesterId: draft.targetSemesterId,
        targetVersions: Object.fromEntries(
          (draft.targetBoard?.placements ?? []).map((row) => [row.id, row.version]),
        ),
      });
  };
  return {
    errors: validation.errors,
    body: validation.body,
    pending: mutation.isPending,
    error: mutation.error?.message,
    submit,
  };
}
