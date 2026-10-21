import type { ReactElement, ReactNode } from "react";
import type { ClassRecordContent } from "@lazuli/validators";
import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { ReferenceFields } from "~/features/shared/reference-fields";
import { NarrativeField } from "~/features/shared/task-form";
import { kindLabels } from "./shared";
export type ContentDraft = Omit<ClassRecordContent, "pageFrom" | "pageTo" | "reference"> & {
  reference: string;
  pageFrom: string;
  pageTo: string;
};
const EMPTY_CONTENT: ContentDraft = {
  kind: "CONTENT",
  account: "",
  reference: "",
  pageFrom: "",
  pageTo: "",
  planItemId: null,
  planItemStatus: "PARTIAL",
};
export function draftContent(value: ClassRecordContent | null): ContentDraft {
  if (!value) return { ...EMPTY_CONTENT };
  return {
    ...value,
    reference: value.reference ?? "",
    pageFrom: value.pageFrom === null ? "" : value.pageFrom.toString(),
    pageTo: value.pageTo === null ? "" : value.pageTo.toString(),
    planItemId: value.planItemId ?? null,
    planItemStatus: value.planItemStatus ?? "PARTIAL",
  };
}
export function contentInput(value: ContentDraft): ClassRecordContent {
  return {
    ...value,
    reference: value.reference || null,
    pageFrom: value.pageFrom ? Number(value.pageFrom) : null,
    pageTo: value.pageTo ? Number(value.pageTo) : null,
  };
}
export function ContentFields({
  prefix,
  value,
  change,
  errors,
  planning,
  clearError,
}: {
  prefix: string;
  value: ContentDraft;
  change: (value: ContentDraft) => void;
  errors: Record<string, string>;
  planning?: ReactNode;
  clearError: (name: string) => void;
}): ReactElement {
  const update = (name: keyof ContentDraft, next: string): void => {
    change({ ...value, [name]: next });
    clearError(`${prefix}-${name}`);
  };
  return (
    <div className="grid min-w-0 gap-3">
      <ActivityKind prefix={prefix} value={value} update={update} />
      {value.kind === "ASSESSMENT" && (
        <p className="text-caption text-muted-foreground">
          Descreva a avaliação realizada nesta aula.
        </p>
      )}
      {planning}
      <NarrativeField
        name={`${prefix}-account`}
        label="O que foi realizado"
        placeholder="Ex.: revisamos perguntas sobre a rotina e praticamos entrevistas em duplas"
        value={value.account}
        onChange={(next) => update("account", next)}
        error={errors[`${prefix}-account`]}
        rows={2}
      />
      <ReferenceFields prefix={prefix} value={value} errors={errors} change={update} />
    </div>
  );
}

function ActivityKind({
  prefix,
  value,
  update,
}: {
  prefix: string;
  value: ContentDraft;
  update: (key: keyof ContentDraft, next: string) => void;
}): ReactElement {
  return (
    <Field>
      <Label id={`${prefix}-kind-label`}>Tipo de atividade</Label>
      <div className="min-w-0">
        <SegmentedControl
          size="sm"
          wrap
          aria-labelledby={`${prefix}-kind-label`}
          value={value.kind}
          onValueChange={(next) => {
            if (next) update("kind", next);
          }}
        >
          {Object.entries(kindLabels).map(([kind, label]) => (
            <SegmentedControlItem key={kind} value={kind}>
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
    </Field>
  );
}
