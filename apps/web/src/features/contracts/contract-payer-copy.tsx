"use client";

import type { ReactElement } from "react";
import { Copy } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import type { FormProps } from "./contract-form-fields";

type Props = Pick<FormProps, "fields" | "change">;
type Source = {
  name: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};
type Profile = NonNullable<RouterOutputs["students"]["byId"]>;

function studentSource(fields: Props["fields"], profile?: Profile): Source | null {
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

function guardianSource(fields: Props["fields"], profile?: Profile): Source | null {
  if (fields.studentMode === "create") {
    if (fields.studentGuardianMode !== "create") return null;
    return {
      name: fields.studentGuardianName,
      phone: fields.studentGuardianPhone,
      email: fields.studentGuardianEmail,
    };
  }
  if (profile?.id !== fields.studentId || !profile.guardian) return null;
  return { name: profile.guardian.fullName, ...profile.guardian };
}

export function PayerCopyButton({ fields, change }: Props): ReactElement {
  const profile = trpc.students.byId.useQuery(
    { id: fields.studentId },
    { enabled: fields.studentMode === "existing" && Boolean(fields.studentId) },
  );
  const guardian = guardianSource(fields, profile.data);
  const student = studentSource(fields, profile.data);
  const source = guardian?.name.trim() ? guardian : student;
  const copySource = source?.name.trim() ? source : null;
  const fromGuardian = Boolean(guardian?.name.trim());
  const copy = (): void => {
    if (!copySource) return;
    change("payerMode", "create");
    change("payerId", "");
    change("payerLabel", "");
    change("payerName", copySource.name);
    change("payerDocumentType", copySource.documentType ?? "");
    change("payerDocumentNumber", copySource.documentNumber ?? "");
    change("payerPhone", copySource.phone ?? "");
    change("payerEmail", copySource.email ?? "");
  };
  return (
    <button
      aria-label={fromGuardian ? "Copiar responsável para pagador" : "Copiar aluno para pagador"}
      title={fromGuardian ? "Copiar responsável" : "Copiar aluno"}
      type="button"
      disabled={!copySource}
      onClick={copy}
      className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-disabled"
    >
      <Copy aria-hidden="true" className="size-4" />
    </button>
  );
}
