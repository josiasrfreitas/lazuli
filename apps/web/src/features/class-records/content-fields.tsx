import type { ReactElement } from "react";
import type { ClassRecordContent } from "@lazuli/validators";
import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { TextControl } from "~/features/classes/form-controls";
import { NarrativeField } from "~/features/shared/task-form";
import { kindLabels } from "./shared";
import { LessonProgress, type LessonPlanningScope } from "./lesson-progress";
export type ContentDraft = Omit<ClassRecordContent, "pageFrom" | "pageTo" | "reference"> & {
  reference: string;
  pageFrom: string;
  pageTo: string;
};
export function draftContent(value: ClassRecordContent | null): ContentDraft {
  return {
    kind: value?.kind ?? "CONTENT",
    account: value?.account ?? "",
    reference: value?.reference ?? "",
    pageFrom: value?.pageFrom?.toString() ?? "",
    pageTo: value?.pageTo?.toString() ?? "",
    planItemId: value?.planItemId ?? null,
    planItemStatus: value?.planItemStatus ?? "PARTIAL",
    planItemTitle: value?.planItemTitle,
  };
}
export function contentInput(value: ContentDraft) {
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
}: {
  prefix: string;
  value: ContentDraft;
  change: (value: ContentDraft) => void;
  errors: Record<string, string>;
  planning?: LessonPlanningScope;
}): ReactElement {
  const update = (name: keyof ContentDraft, next: string): void =>
    change({ ...value, [name]: next });
  return (
    <div className="grid min-w-0 gap-3">
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
      {value.kind === "ASSESSMENT" && (
        <p className="text-caption text-muted-foreground">
          Esta aula será registrada como avaliação. As notas e provas são lançadas no aluno.
        </p>
      )}
      {planning && (
        <LessonProgress scope={planning} prefix={prefix} value={value} change={change} />
      )}
      <NarrativeField
        name={`${prefix}-account`}
        label="O que foi realizado"
        placeholder="Ex.: revisamos perguntas sobre a rotina e praticamos entrevistas em duplas"
        value={value.account}
        onChange={(next) => update("account", next)}
        error={errors[`${prefix}-account`]}
        rows={2}
      />
      <details
        className="rounded-md border border-border p-3"
        open={
          Boolean(
            value.reference ||
            value.pageFrom ||
            value.pageTo ||
            errors[`${prefix}-pageTo`] ||
            errors[`${prefix}-pageFrom`],
          ) || undefined
        }
      >
        <summary className="cursor-pointer text-caption font-medium">
          Lição e páginas · opcionais
        </summary>
        <div className="mt-3 grid gap-3">
          <TextControl
            name={`${prefix}-reference`}
            label="Lição ou referência"
            placeholder="Ex.: Unit 3 · Student’s Book"
            value={value.reference}
            onChange={(next) => update("reference", next)}
            error={errors[`${prefix}-reference`]}
          />
          <div className="flex flex-wrap gap-3">
            {(["pageFrom", "pageTo"] as const).map((name) => (
              <div className="w-28" key={name}>
                <TextControl
                  name={`${prefix}-${name}`}
                  label={name === "pageFrom" ? "Página inicial" : "Página final"}
                  inputMode="numeric"
                  placeholder={name === "pageFrom" ? "Ex.: 24" : "Ex.: 27"}
                  value={value[name]}
                  onChange={(next) => update(name, next)}
                  error={errors[`${prefix}-${name}`]}
                />
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
