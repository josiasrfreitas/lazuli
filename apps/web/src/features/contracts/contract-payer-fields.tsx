"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Copy } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import {
  SelectionValue,
  Button,
  FormRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type SearchSelectOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker, type ContractPartyOption } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change"> & {
  showCopyHint?: boolean;
  keepCopyVisible?: boolean;
  expanded?: boolean;
};
const MINUTES_PER_HINT_INTERVAL = 30;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const COPY_HINT_INTERVAL_MS =
  MINUTES_PER_HINT_INTERVAL * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const COPY_HINT_DELAY_MS = 650;
const COPY_HINT_DURATION_MS = 4500;
const hintShownAt = new Map<string, number>();

function useCopyHint(
  enabled: boolean,
  source: "guardian" | "student",
): {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} {
  const [automaticOpen, setAutomaticOpen] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const interacted = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const key = `lazuli.contract.copy-payer-hint.${source}`;
    let lastShown = hintShownAt.get(key) ?? 0;
    try {
      lastShown = Number(sessionStorage.getItem(key)) || lastShown;
    } catch {
      /* Use the in-memory interval when storage is unavailable. */
    }
    if (Date.now() - lastShown < COPY_HINT_INTERVAL_MS) return;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const showTimer = globalThis.setTimeout(() => {
      if (interacted.current) return;
      const shownAt = Date.now();
      hintShownAt.set(key, shownAt);
      try {
        sessionStorage.setItem(key, String(shownAt));
      } catch {
        /* The hint remains usable without storage. */
      }
      setAutomaticOpen(true);
      closeTimer = globalThis.setTimeout(() => setAutomaticOpen(false), COPY_HINT_DURATION_MS);
    }, COPY_HINT_DELAY_MS);
    return () => {
      globalThis.clearTimeout(showTimer);
      globalThis.clearTimeout(closeTimer);
      setAutomaticOpen(false);
    };
  }, [enabled, source]);
  return {
    open: interactiveOpen || (enabled && automaticOpen),
    onOpenChange: (open) => {
      interacted.current = true;
      setInteractiveOpen(open);
      if (!open) setAutomaticOpen(false);
    },
  };
}
type Source = {
  name: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};
type Profile = NonNullable<RouterOutputs["students"]["byId"]>;

function studentSource(fields: PayerProps["fields"], profile?: Profile): Source | null {
  if (fields.studentMode === "create")
    return {
      name: fields.studentDraftName,
      documentType: fields.studentDocumentType,
      documentNumber: fields.studentDocumentNumber,
      phone: fields.studentPhone,
      email: fields.studentEmail,
    };
  if (profile?.id !== fields.studentId || !profile.contact) return null;
  return { name: profile.contact.fullName, ...profile.contact };
}

function guardianSource(fields: PayerProps["fields"], profile?: Profile): Source | null {
  if (fields.studentMode === "create") {
    if (fields.studentGuardianMode !== "create") return null;
    return {
      name: fields.studentGuardianName,
      documentType: fields.studentGuardianDocumentType,
      documentNumber: fields.studentGuardianDocumentNumber,
      phone: fields.studentGuardianPhone,
      email: fields.studentGuardianEmail,
    };
  }
  if (profile?.id !== fields.studentId || !profile.guardian) return null;
  return { name: profile.guardian.fullName, ...profile.guardian };
}

function hasCompleteContact(source: Source): boolean {
  return Boolean(
    source.name.trim() &&
    source.documentType?.trim() &&
    source.documentNumber?.trim() &&
    (source.phone?.trim() || source.email?.trim()),
  );
}

function PayerCopyButton({
  fields,
  change,
  onCopyComplete,
  showCopyHint = false,
}: Pick<PayerProps, "fields" | "change" | "showCopyHint"> & {
  onCopyComplete: (complete: boolean) => void;
}): ReactElement {
  const profile = trpc.students.byId.useQuery(
    { id: fields.studentId },
    { enabled: fields.studentMode === "existing" && Boolean(fields.studentId) },
  );
  const guardian = guardianSource(fields, profile.data);
  const student = studentSource(fields, profile.data);
  const copySource = usableCopySource(guardian, student);
  const fromGuardian = Boolean(guardian?.name.trim());
  const triggerId = useId();
  const hint = useCopyHint(
    showCopyHint && Boolean(copySource),
    fromGuardian ? "guardian" : "student",
  );
  const copy = (): void => {
    copyPayer({
      source: copySource,
      change,
      onCopyComplete,
      closeHint: () => hint.onOpenChange(false),
    });
  };
  return (
    <Tooltip open={hint.open} onOpenChange={hint.onOpenChange} triggerId={triggerId}>
      <PayerCopyTrigger {...{ triggerId, fromGuardian, copySource, copy }} />
      <TooltipContent side="top" align="end">
        {fromGuardian
          ? "Copiar dados do responsável para o pagador"
          : "Copiar dados do aluno para o pagador"}
      </TooltipContent>
    </Tooltip>
  );
}

function PayerCopyTrigger({
  triggerId,
  fromGuardian,
  copySource,
  copy,
}: {
  triggerId: string;
  fromGuardian: boolean;
  copySource: Source | null;
  copy: () => void;
}): ReactElement {
  return (
    <TooltipTrigger
      id={triggerId}
      render={
        <Button
          aria-label={
            fromGuardian ? "Copiar responsável para pagador" : "Copiar aluno para pagador"
          }
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!copySource}
          onClick={copy}
        >
          <Copy aria-hidden="true" />
        </Button>
      }
    />
  );
}

function usableCopySource(guardian: Source | null, student: Source | null): Source | null {
  if (guardian?.name.trim()) return guardian;
  return student?.name.trim() ? student : null;
}

function copyPayer({
  source,
  change,
  onCopyComplete,
  closeHint,
}: {
  source: Source | null;
  change: PayerProps["change"];
  onCopyComplete: (complete: boolean) => void;
  closeHint: () => void;
}): void {
  if (!source) return;
  closeHint();
  change("payerMode", "create");
  change("payerId", "");
  change("payerLabel", "");
  change("payerName", source.name);
  change("payerDocumentType", source.documentType ?? "");
  change("payerDocumentNumber", source.documentNumber ?? "");
  change("payerPhone", source.phone ?? "");
  change("payerEmail", source.email ?? "");
  onCopyComplete(hasCompleteContact(source));
}

function clearPayer(change: PayerProps["change"]): void {
  change("payerMode", "existing");
  change("payerId", "");
  change("payerLabel", "");
  change("payerName", "");
  change("payerDocumentType", "");
  change("payerDocumentNumber", "");
  change("payerPhone", "");
  change("payerEmail", "");
}

function payerTag(
  fields: PayerProps["fields"],
  copiedComplete: boolean,
): SearchSelectOption | null {
  if (!copiedComplete || fields.payerMode !== "create") return null;
  return { id: "copied-payer", label: fields.payerName, document: fields.payerDocumentNumber };
}

type PickerProps = PayerProps & {
  tag: SearchSelectOption | null;
  showCopy: boolean;
  setCopiedComplete: (complete: boolean) => void;
};

function PayerControl({
  fields,
  errors,
  change,
  tag,
  showCopy,
  showCopyHint,
  expanded,
  setCopiedComplete,
}: PickerProps): ReactElement {
  const handlers = payerPickerHandlers({ change, expanded: Boolean(expanded), setCopiedComplete });
  return (
    <PartyPicker
      kind="payer"
      createMode={fields.payerMode === "create" || Boolean(expanded && !fields.payerId)}
      draftName={fields.payerName}
      draftValue={tag}
      showAdornment={showCopy}
      endAdornment={
        <PayerCopyButton
          fields={fields}
          change={change}
          showCopyHint={Boolean(showCopyHint && showCopy)}
          onCopyComplete={setCopiedComplete}
        />
      }
      value={
        fields.payerMode === "existing" && fields.payerId
          ? { id: fields.payerId, label: fields.payerLabel }
          : null
      }
      {...handlers}
      error={fields.payerMode === "create" ? errors.payerName : errors.payerId}
    />
  );
}

function payerPickerHandlers({
  change,
  expanded,
  setCopiedComplete,
}: Pick<PickerProps, "change" | "expanded" | "setCopiedComplete">): {
  onChange: (option: ContractPartyOption | null) => void;
  onClear: () => void;
  onSearchChange: (query: string) => void;
  onCreate: (query: string) => void;
} {
  return {
    onChange: (option) => {
      setCopiedComplete(false);
      applyPayerOption(option, change);
    },
    onClear: () => {
      setCopiedComplete(false);
      clearPayer(change);
    },
    onSearchChange: (query) => {
      if (expanded) change("payerMode", "create");
      change("payerName", query);
    },
    onCreate: (query) => {
      setCopiedComplete(false);
      change("payerMode", "create");
      change("payerName", query.trim());
    },
  };
}

function applyPayerOption(option: ContractPartyOption | null, change: PayerProps["change"]): void {
  if (option) change("payerMode", "existing");
  change("payerId", option?.id ?? "");
  change("payerLabel", option?.label ?? "");
  if (!option) return;
  applyPayerContact(option, change);
}

function applyPayerContact(option: ContractPartyOption, change: PayerProps["change"]): void {
  change("payerName", option.label);
  change("payerDocumentType", option.documentType ?? "");
  change("payerDocumentNumber", option.document ?? "");
  change("payerPhone", option.phone ?? "");
  change("payerEmail", option.email ?? "");
}

export function ContractPayerFields({
  fields,
  errors,
  change,
  showCopyHint = false,
  keepCopyVisible = false,
  expanded = false,
}: PayerProps): ReactElement {
  const [copiedComplete, setCopiedComplete] = useState(false);
  const hasPayerError = Object.entries(errors).some(
    ([name, error]) => name.startsWith("payer") && Boolean(error),
  );
  const { tag, showCopy, showDraftFields } = payerFieldVisibility(fields, {
    expanded,
    hasPayerError,
    copiedComplete,
    keepCopyVisible,
  });
  const { edit, editDetails } = payerEditors({ fields, change, expanded, setCopiedComplete });
  if (
    selectedPayerIsComplete(fields, expanded) ||
    (copiedComplete && fields.payerMode === "create")
  ) {
    return (
      <SelectedPayerDetails
        fields={fields}
        onClear={() => {
          setCopiedComplete(false);
          clearPayer(change);
        }}
      />
    );
  }
  return (
    <div className="space-y-3">
      <FormRow columns={showDraftFields ? 2 : 1}>
        <PayerControl
          {...{ fields, errors, tag, showCopy, showCopyHint, expanded, setCopiedComplete }}
          change={edit}
        />
        {showDraftFields && (
          <PersonDocument fields={fields} errors={errors} change={editDetails} kind="payer" />
        )}
      </FormRow>
      {showDraftFields && (
        <InlinePersonFields fields={fields} errors={errors} change={editDetails} kind="payer" />
      )}
    </div>
  );
}

function payerEditors({
  fields,
  change,
  expanded,
  setCopiedComplete,
}: Pick<PayerProps, "fields" | "change" | "expanded"> & {
  setCopiedComplete: (value: boolean) => void;
}): { edit: PayerProps["change"]; editDetails: PayerProps["change"] } {
  const edit: PayerProps["change"] = (name, value) => {
    setCopiedComplete(false);
    change(name, value);
  };
  const editDetails: PayerProps["change"] = (name, value) => {
    if (expanded && fields.payerMode !== "create") change("payerMode", "create");
    edit(name, value);
  };
  return { edit, editDetails };
}

function selectedPayerIsComplete(fields: PayerProps["fields"], expanded: boolean): boolean {
  return expanded && fields.payerMode === "existing" && Boolean(fields.payerId && fields.payerName);
}

function hasSelectedStudent(fields: PayerProps["fields"]): boolean {
  return fields.studentMode === "create"
    ? Boolean(fields.studentDraftName.trim())
    : Boolean(fields.studentId);
}

function payerFieldVisibility(
  fields: PayerProps["fields"],
  {
    expanded,
    hasPayerError,
    copiedComplete,
    keepCopyVisible,
  }: {
    expanded: boolean;
    hasPayerError: boolean;
    copiedComplete: boolean;
    keepCopyVisible: boolean;
  },
): { tag: SearchSelectOption | null; showCopy: boolean; showDraftFields: boolean } {
  const tag = expanded || hasPayerError ? null : payerTag(fields, copiedComplete);
  const studentSelected = hasSelectedStudent(fields);
  const canCopy = !tag && (fields.payerMode === "create" || !fields.payerId);
  const showCopy = studentSelected && (keepCopyVisible || canCopy);
  const showDraftFields = (expanded && !fields.payerId) || (fields.payerMode === "create" && !tag);
  return { tag, showCopy, showDraftFields };
}

function SelectedPayerDetails({
  fields,
  onClear,
}: {
  fields: PayerProps["fields"];
  onClear: () => void;
}): ReactElement {
  return (
    <div className="space-y-3">
      <FormRow columns={2}>
        <PayerValue label="Nome do pagador" value={fields.payerName} onClear={onClear} />
        <PayerValue label="CPF ou RG" value={fields.payerDocumentNumber} />
      </FormRow>
      <FormRow columns={2}>
        <PayerValue label="Telefone" value={fields.payerPhone} />
        <PayerValue label="E-mail" value={fields.payerEmail} />
      </FormRow>
    </div>
  );
}

function PayerValue({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear?: () => void;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-1.5" role="group" aria-label={label}>
      <span className="text-caption font-medium leading-4">{label}</span>
      <SelectionValue value={value} onClear={onClear} clearLabel="Limpar pagador e seus dados" />
    </div>
  );
}
