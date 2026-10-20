"use client";
import { useState, type RefObject } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { type FinancialTreatmentPreview } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { useScrollToError } from "~/lib/scroll-to-error";
import { treatmentRequest, type TreatmentErrors } from "./treatment-request";
import { TreatmentConfirmation } from "./treatment-confirmation";

export type TreatmentRow = RouterOutputs["finance"]["treatmentInstallments"]["rows"][number];
export type TreatmentReview = {
  request: FinancialTreatmentPreview;
  result: RouterOutputs["finance"]["previewTreatment"];
  reason: string;
  commandId: string;
};
type Available = {
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
};
export type TreatmentState = {
  available: Available;
  batch: boolean;
  rows: TreatmentRow[];
  chosen: TreatmentRow[];
  selected: string[];
  showAll: boolean;
  amounts: Record<string, string>;
  suspension: boolean;
  suspensionOnly: boolean;
  until: string;
  reason: string;
  errors: TreatmentErrors;
  error: string | undefined;
  pending: boolean;
  uncertain: boolean;
  isLocked: () => boolean;
  review: TreatmentReview | undefined;
  body: RefObject<HTMLDivElement | null>;
  balance: number;
  charges: number;
  submit: () => Promise<void>;
  toggle: (id: string, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
  showAllRows: () => void;
  changeAmount: (id: string, value: string) => void;
  changeSuspension: (value: boolean) => void;
  changeUntil: (value: string) => void;
  changeReason: (value: string) => void;
  edit: () => void;
};
function useTreatmentRows(
  studentId: string | undefined,
  initialIds: string[],
): { available: Available; rows: TreatmentRow[] } {
  const query = trpc.finance.treatmentInstallments.useInfiniteQuery(
    studentId ? { studentId } : { installmentIds: initialIds },
    { getNextPageParam: (page) => page.nextCursor, staleTime: 0 },
  );
  const initial = trpc.finance.treatmentInstallments.useQuery(
    { studentId, installmentIds: initialIds },
    { enabled: initialIds.length > 0, staleTime: 0 },
  );
  const rows = [
    ...new Map(
      [
        ...(initial.data?.rows ?? []),
        ...(query.data?.pages.flatMap((page) => page.rows) ?? []),
      ].map((row) => [row.id, row]),
    ).values(),
  ];
  return {
    rows,
    available: {
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: async () => {
        await query.fetchNextPage();
      },
      isPending: query.isPending || (initialIds.length > 0 && initial.isPending),
      isError: query.isError || (initialIds.length > 0 && initial.isError),
      refetch: async () => {
        await Promise.all([query.refetch(), ...(initialIds.length > 0 ? [initial.refetch()] : [])]);
      },
    },
  };
}
function useTreatmentDraft(initialIds: string[]): {
  selected: string[];
  setSelected: (ids: string[] | ((current: string[]) => string[])) => void;
  amounts: Record<string, string>;
  setAmounts: (value: (current: Record<string, string>) => Record<string, string>) => void;
  suspend: boolean;
  setSuspend: (value: boolean) => void;
  until: string;
  setUntil: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
} {
  const [selected, setSelected] = useState(initialIds);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [suspend, setSuspend] = useState(false);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  return {
    selected,
    setSelected,
    amounts,
    setAmounts,
    suspend,
    setSuspend,
    until,
    setUntil,
    reason,
    setReason,
  };
}
type TreatmentFlow = {
  review: TreatmentReview | undefined;
  error: string | undefined;
  pending: boolean;
  uncertain: boolean;
  isLocked: () => boolean;
  body: RefObject<HTMLDivElement | null>;
  errors: TreatmentErrors;
  clear: (...names: string[]) => void;
  edit: () => void;
  submit: (draft: Parameters<typeof treatmentRequest>[0]) => Promise<void>;
};
function useTreatmentConfirmation(
  onClose: () => void,
  onConfirmed?: () => void,
): {
  save: ReturnType<typeof trpc.finance.confirmTreatment.useMutation>;
  attempt: TreatmentConfirmation;
  uncertain: boolean;
} {
  const utils = trpc.useUtils();
  const [attempt] = useState(() => new TreatmentConfirmation());
  const [uncertain, setUncertain] = useState(false);
  const save = trpc.finance.confirmTreatment.useMutation({
    onSuccess: () => {
      attempt.complete();
      setUncertain(false);
      void Promise.all([utils.finance.invalidate(), utils.students.list.invalidate()]);
      onConfirmed?.();
      onClose();
    },
    onError: (error) => {
      attempt.reject(error.data?.code);
      setUncertain(attempt.uncertain);
    },
  });
  return { save, attempt, uncertain };
}
function useTreatmentReview(onClose: () => void, onConfirmed?: () => void): TreatmentFlow {
  const utils = trpc.useUtils();
  const [review, setReview] = useState<TreatmentReview>();
  const [error, setError] = useState<string>();
  const [errors, setErrors] = useState<TreatmentErrors>({});
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const { save, attempt, uncertain } = useTreatmentConfirmation(onClose, onConfirmed);

  return {
    review,
    error: uncertain
      ? "Não foi possível confirmar o resultado. Verifique a confirmação antes de alterar ou fechar o acordo."
      : (error ?? save.error?.message),
    uncertain,
    isLocked: () => loading || attempt.locked,
    pending: loading || save.isPending,
    body,
    errors,
    submit: (draft) =>
      submitTreatment({
        draft,
        loading,
        review,
        save,
        attempt,
        utils,
        body,
        setError,
        setErrors,
        setRevision,
        setLoading,
        setReview,
      }),
    clear: (...names) => {
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !names.includes(key))),
      );
      setError(undefined);
      save.reset();
    },
    edit: () => {
      if (attempt.locked) return;
      setReview(undefined);
      save.reset();
    },
  };
}

type SubmitContext = {
  draft: Parameters<typeof treatmentRequest>[0];
  loading: boolean;
  review: TreatmentReview | undefined;
  save: ReturnType<typeof trpc.finance.confirmTreatment.useMutation>;
  attempt: TreatmentConfirmation;
  utils: ReturnType<typeof trpc.useUtils>;
  body: RefObject<HTMLDivElement | null>;
  setError: (error: string | undefined) => void;
  setErrors: (errors: TreatmentErrors) => void;
  setRevision: (updater: (value: number) => number) => void;
  setLoading: (value: boolean) => void;
  setReview: (value: TreatmentReview) => void;
};
async function submitTreatment(context: SubmitContext): Promise<void> {
  const {
    draft,
    loading,
    save,
    attempt,
    review,
    utils,
    body,
    setError,
    setErrors,
    setRevision,
    setLoading,
    setReview,
  } = context;
  if (loading || attempt.pending) return;
  setError(undefined);
  if (review) {
    const command = attempt.begin({
      ...review.request,
      reason: review.reason,
      version: review.result.version,
      commandId: review.commandId,
    });
    if (command) save.mutate(command);
    return;
  }
  const result = treatmentRequest(draft);
  if (Object.keys(result.errors).length > 0 || !result.request) {
    setErrors(result.errors);
    setRevision((value) => value + 1);
    return;
  }
  setLoading(true);
  try {
    const preview = await utils.finance.previewTreatment.fetch(result.request);
    setReview({
      request: result.request,
      result: preview,
      reason: draft.reason.trim(),
      commandId: crypto.randomUUID(),
    });
    body.current?.scrollTo({ top: 0 });
  } catch (error_) {
    setError(error_ instanceof Error ? error_.message : "Não foi possível preparar a tratativa.");
  } finally {
    setLoading(false);
  }
}
export function useTreatment({
  studentId,
  initialIds,
  onClose,
  onConfirmed,
}: {
  studentId: string | undefined;
  initialIds: string[];
  onClose: () => void;
  onConfirmed: (() => void) | undefined;
}): TreatmentState {
  const { available, rows } = useTreatmentRows(studentId, initialIds);
  const draft = useTreatmentDraft(initialIds);
  const flow = useTreatmentReview(onClose, onConfirmed);
  const [showAll, setShowAll] = useState(!studentId || initialIds.length === 0);
  const chosen = rows.filter((row) => draft.selected.includes(row.id));
  const charges = chosen.reduce((sum, row) => sum + row.chargesCents, 0);
  const balance = chosen.reduce((sum, row) => sum + row.balanceCents, 0);
  const suspensionOnly = chosen.length > 0 && charges === 0;
  const suspension = draft.suspend || suspensionOnly;
  return {
    ...draft,
    ...flow,
    available,
    rows,
    chosen,
    batch: !studentId,
    showAll,
    charges,
    balance,
    suspension,
    suspensionOnly,
    submit: async () => {
      if (flow.review || (!available.isPending && !available.isError))
        await flow.submit({ ...draft, studentId, chosen, suspension });
    },
    ...treatmentActions({ draft, flow, rows }),
    showAllRows: () => setShowAll(true),
  };
}

const MAX_SELECTION = 100;
function treatmentActions({
  draft,
  flow,
  rows,
}: {
  draft: ReturnType<typeof useTreatmentDraft>;
  flow: TreatmentFlow;
  rows: TreatmentRow[];
}): Pick<
  TreatmentState,
  "toggle" | "toggleAll" | "changeAmount" | "changeSuspension" | "changeUntil" | "changeReason"
> {
  return {
    toggle: (id, checked) => {
      draft.setSelected((ids) =>
        checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id),
      );
      flow.clear("selection", "action", "until");
    },
    toggleAll: (checked) => {
      draft.setSelected(checked ? rows.slice(0, MAX_SELECTION).map((row) => row.id) : []);
      flow.clear("selection", "action", "until");
    },
    changeAmount: (id, value) => {
      draft.setAmounts((current) => ({ ...current, [id]: value }));
      flow.clear(id, "action");
    },
    changeSuspension: (value) => {
      draft.setSuspend(value);
      flow.clear("action", "until");
    },
    changeUntil: (value) => {
      draft.setUntil(value);
      flow.clear("until");
    },
    changeReason: (value) => {
      draft.setReason(value);
      flow.clear("reason");
    },
  };
}
