import { useState, type FormEvent, type ReactElement } from "react";
import { TextControl } from "~/features/classes/form-controls";
import { TaskDialog } from "~/features/shared/task-form";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import type { OrganizationBoard, Placement } from "./model";
import { reviewEffectiveDate } from "./review-model";
import { dateOnly, useOrganizationRefresh } from "./shared";

type Props = {
  row: Placement;
  board: OrganizationBoard;
  onFeedback: (message: string) => void;
  onClose: () => void;
};

export function PlacementDateDialog({ row, board, onFeedback, onClose }: Props): ReactElement {
  const original = reviewEffectiveDate(row, board);
  const [value, setValue] = useState(() => formatDateOnlyBR(original));
  const [error, setError] = useState("");
  const refresh = useOrganizationRefresh();
  const save = trpc.semesterOrganization.savePlacement.useMutation({
    onSuccess: async (_, input) => {
      await refresh();
      onFeedback(
        `Vigência da proposta de ${row.studentName} alterada para ${formatDateOnlyBR(input.effectiveDate)}.`,
      );
      onClose();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const effectiveDate = parseDateBR(value);
    if (
      !effectiveDate ||
      effectiveDate < toDateOnlySaoPaulo(new Date()) ||
      effectiveDate < dateOnly(board.semester.startDate) ||
      effectiveDate > dateOnly(board.semester.endDate)
    ) {
      setError("Informe uma data de hoje em diante, dentro do período letivo.");
      return;
    }
    if (!save.isPending && !row.publishedAt && !row.declinedAt)
      save.mutate({
        id: row.id,
        version: row.version,
        semesterId: row.semesterId,
        studentId: row.studentId,
        sourceProgressId: row.sourceProgressId,
        mode: row.mode,
        stageId: row.stageId,
        planId: row.planId,
        effectiveDate,
        notes: row.notes ?? "",
      });
  }
  return (
    <TaskDialog
      compactHeader
      size="compact"
      title="Corrigir vigência da proposta"
      description={row.studentName}
      formId="review-placement-date"
      firstField="review-effective-date"
      submitLabel="Salvar vigência"
      submitDisabled={parseDateBR(value) === original}
      pending={save.isPending}
      error={save.error?.message}
      onClose={onClose}
    >
      <form id="review-placement-date" noValidate onSubmit={submit}>
        <PlacementDateField
          value={value}
          error={error}
          onChange={(date) => {
            setValue(date);
            setError("");
          }}
        />
      </form>
    </TaskDialog>
  );
}

export function PlacementDateField({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="max-w-44">
      <TextControl
        name="review-effective-date"
        label="Vigência proposta"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        value={value}
        error={error}
        onChange={(raw) => onChange(maskDateBR(raw))}
      />
    </div>
  );
}
