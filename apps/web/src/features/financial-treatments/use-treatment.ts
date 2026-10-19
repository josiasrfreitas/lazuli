"use client";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  financialTreatmentPreviewSchema,
  type FinancialTreatmentPreview,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { useScrollToError } from "~/lib/scroll-to-error";

export type TreatmentRow = RouterOutputs["finance"]["treatmentInstallments"][number];
export type TreatmentReview = {
  request: FinancialTreatmentPreview;
  result: RouterOutputs["finance"]["previewTreatment"];
  reason: string;
  commandId: string;
};

export function useTreatment(
  studentId: string | undefined,
  initialIds: string[],
  onClose: () => void,
  onConfirmed?: () => void,
) {
  const utils = trpc.useUtils();
  const available = trpc.finance.treatmentInstallments.useQuery(
    studentId ? { studentId } : { installmentIds: initialIds },
  );
  const [showAll, setShowAll] = useState(!studentId || initialIds.length === 0);
  const [selected, setSelected] = useState(initialIds);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [suspend, setSuspend] = useState(false);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const [review, setReview] = useState<TreatmentReview>();
  const save = trpc.finance.confirmTreatment.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.finance.invalidate(), utils.students.list.invalidate()]);
      onConfirmed?.();
      onClose();
    },
  });
  const rows = available.data ?? [];
  const chosen = rows.filter((row) => selected.includes(row.id));
  const charges = chosen.reduce((sum, row) => sum + row.chargesCents, 0);
  const balance = chosen.reduce((sum, row) => sum + row.balanceCents, 0);
  const suspensionOnly = chosen.length > 0 && charges === 0;
  const suspension = suspend || suspensionOnly;
  const pending = loading || save.isPending;
  function clear(name: string) {
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)),
    );
    setError(undefined);
    save.reset();
  }
  async function submit() {
    if (pending || available.isPending || available.isError) return;
    setError(undefined);
    if (review) {
      save.mutate({
        ...review.request,
        reason: review.reason,
        version: review.result.version,
        commandId: review.commandId,
      });
      return;
    }
    const invalid: Record<string, string> = {};
    if (!chosen.length) invalid.selection = "Selecione ao menos uma parcela.";
    if (chosen.length !== selected.length)
      invalid.selection = "Uma parcela não está mais disponível. Revise a seleção.";
    if (chosen.length > 100) invalid.selection = "Selecione até 100 parcelas por tratativa.";
    if (reason.trim().length < 3)
      invalid.reason = "Descreva o que foi combinado com o responsável.";
    if (reason.trim().length > 2000) invalid.reason = "Use até 2.000 caracteres.";
    const newDueDate = suspension ? parseDateBR(until) : null;
    if (suspension) {
      if (!newDueDate) invalid.until = "Informe uma data válida.";
      else if (newDueDate <= saoPauloDateOnly(new Date()))
        invalid.until = "Escolha uma data posterior a hoje.";
      else if (chosen.some((row) => row.dueDate > newDueDate))
        invalid.until = "A data não pode antecipar o vencimento de nenhuma parcela selecionada.";
    }
    const choices = chosen.map((row) => {
      const reductionCents = row.chargesCents > 0 ? parseReduction(amounts[row.id] ?? "0,00") : 0;
      if (!Number.isFinite(reductionCents)) invalid[row.id] = "Informe um valor, como 10,00.";
      else if (reductionCents > row.chargesCents)
        invalid[row.id] = "A redução não pode superar os encargos.";
      return {
        installmentId: row.id,
        reductionCents,
        forgiveCharges: false,
      };
    });
    if (!suspension && choices.every((row) => row.reductionCents === 0))
      invalid.action = "Reduza os encargos ou defina um novo vencimento.";
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      setRevision((value) => value + 1);
      return;
    }
    const parsed = financialTreatmentPreviewSchema.safeParse({
      studentId,
      rows: choices,
      ...(newDueDate ? { newDueDate } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }
    setLoading(true);
    try {
      const result = await utils.finance.previewTreatment.fetch(parsed.data);
      setReview({
        request: parsed.data,
        result,
        reason: reason.trim(),
        commandId: crypto.randomUUID(),
      });
      body.current?.scrollTo({ top: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar a tratativa.");
    } finally {
      setLoading(false);
    }
  }
  return {
    available,
    batch: !studentId,
    rows,
    chosen,
    selected,
    showAll,
    amounts,
    suspension,
    suspensionOnly,
    until,
    reason,
    errors,
    error: error ?? save.error?.message,
    pending,
    review,
    body,
    balance,
    charges,
    submit,
    toggle(id: string, checked: boolean) {
      setSelected((ids) =>
        checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id),
      );
      clear("selection");
      clear("action");
      clear("until");
    },
    toggleAll(checked: boolean) {
      setSelected(checked ? rows.map((row) => row.id) : []);
      clear("selection");
      clear("action");
      clear("until");
    },
    showAllRows() {
      setShowAll(true);
    },
    changeAmount(id: string, value: string) {
      setAmounts((current) => ({ ...current, [id]: value }));
      clear(id);
      clear("action");
    },
    changeSuspension(value: boolean) {
      setSuspend(value);
      clear("action");
      clear("until");
    },
    changeUntil(value: string) {
      setUntil(value);
      clear("until");
    },
    changeReason(value: string) {
      setReason(value);
      clear("reason");
    },
    edit() {
      setReview(undefined);
      save.reset();
    },
  };
}
export type TreatmentState = ReturnType<typeof useTreatment>;

function parseReduction(value: string): number {
  const clean = value.trim();
  if (clean === "") return 0;
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean.replace(",", ".")) * 100);
}
