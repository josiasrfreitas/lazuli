"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Copy } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Button,
  Field,
  Input,
  Label,
  FormRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type SearchSelectOption,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change"> & {
  showCopyHint?: boolean;
  keepCopyVisible?: boolean;
  expanded?: boolean;
};
const COPY_HINT_INTERVAL_MS = 30 * 60 * 1000;
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
    let closeTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      if (interacted.current) return;
      const shownAt = Date.now();
      hintShownAt.set(key, shownAt);
      try {
        sessionStorage.setItem(key, String(shownAt));
      } catch {
        /* The hint remains usable without storage. */
      }
      setAutomaticOpen(true);
      closeTimer = window.setTimeout(() => setAutomaticOpen(false), COPY_HINT_DURATION_MS);
    }, COPY_HINT_DELAY_MS);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(closeTimer);
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
  const source = guardian?.name.trim() ? guardian : student;
  const copySource = source?.name.trim() ? source : null;
  const fromGuardian = Boolean(guardian?.name.trim());
  const triggerId = useId();
  const hint = useCopyHint(
    showCopyHint && Boolean(copySource),
    fromGuardian ? "guardian" : "student",
  );
  const copy = (): void => {
    if (!copySource) return;
    hint.onOpenChange(false);
    change("payerMode", "create");
    change("payerId", "");
    change("payerLabel", "");
    change("payerName", copySource.name);
    change("payerDocumentType", copySource.documentType ?? "");
    change("payerDocumentNumber", copySource.documentNumber ?? "");
    change("payerPhone", copySource.phone ?? "");
    change("payerEmail", copySource.email ?? "");
    onCopyComplete(hasCompleteContact(copySource));
  };
  return (
    <Tooltip open={hint.open} onOpenChange={hint.onOpenChange} triggerId={triggerId}>
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
      <TooltipContent side="top" align="end">
        {fromGuardian
          ? "Copiar dados do responsável para o pagador"
          : "Copiar dados do aluno para o pagador"}
      </TooltipContent>
    </Tooltip>
  );
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
  const select = (option: SearchSelectOption | null): void => {
    setCopiedComplete(false);
    if (option) change("payerMode", "existing");
    change("payerId", option?.id ?? "");
    change("payerLabel", option?.label ?? "");
  };
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
      onChange={select}
      onClear={() => {
        setCopiedComplete(false);
        clearPayer(change);
      }}
      onSearchChange={(query) => {
        if (expanded) change("payerMode", "create");
        change("payerName", query);
      }}
      onCreate={(query) => {
        setCopiedComplete(false);
        change("payerMode", "create");
        change("payerName", query.trim());
      }}
      error={fields.payerMode === "create" ? errors.payerName : errors.payerId}
    />
  );
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
  const tag = expanded || hasPayerError ? null : payerTag(fields, copiedComplete);
  const edit: PayerProps["change"] = (name, value) => {
    setCopiedComplete(false);
    change(name, value);
  };
  const editDetails: PayerProps["change"] = (name, value) => {
    if (expanded && fields.payerMode !== "create") change("payerMode", "create");
    edit(name, value);
  };
  const studentSelected =
    fields.studentMode === "create"
      ? Boolean(fields.studentDraftName.trim())
      : Boolean(fields.studentId);
  const showCopy =
    studentSelected &&
    (keepCopyVisible || (!tag && (fields.payerMode === "create" || !fields.payerId)));
  const showDraftFields = (expanded && !fields.payerId) || (fields.payerMode === "create" && !tag);
  if (expanded && fields.payerMode === "existing" && fields.payerId && fields.payerName) {
    return (
      <div className="space-y-3">
        <FormRow columns={2}>
          <Field name="selectedPayerName">
            <Label>Nome do pagador</Label>
            <Input size="sm" readOnly value={fields.payerName} />
          </Field>
          <Field name="selectedPayerDocument">
            <Label>Documento</Label>
            <Input
              size="sm"
              readOnly
              value={fields.payerDocumentNumber}
              placeholder="Não informado"
            />
          </Field>
        </FormRow>
        <FormRow columns={2}>
          <Field name="selectedPayerPhone">
            <Label>Telefone</Label>
            <Input size="sm" readOnly value={fields.payerPhone} placeholder="Não informado" />
          </Field>
          <Field name="selectedPayerEmail">
            <Label>E-mail</Label>
            <Input size="sm" readOnly value={fields.payerEmail} placeholder="Não informado" />
          </Field>
        </FormRow>
        <Button type="button" size="sm" variant="ghost" onClick={() => clearPayer(change)}>
          Trocar pagador
        </Button>
      </div>
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
