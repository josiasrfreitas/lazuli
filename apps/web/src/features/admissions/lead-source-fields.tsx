import type { ReactElement } from "react";
import { leadSourceLabels, leadSourceSchema } from "@lazuli/validators";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import type { CandidateDraft } from "./candidate-model";

type SourceFields = Pick<CandidateDraft, "source" | "sourceDetail">;
const choices = [
  { value: "UNSPECIFIED", label: "Não informada" },
  ...leadSourceSchema.options.map((value) => ({ value, label: leadSourceLabels[value] })),
];

export function LeadSourceFields({
  draft,
  errors,
  change,
}: {
  draft: SourceFields;
  errors: Record<string, string>;
  change: <Key extends keyof SourceFields>(
    key: Key,
    value: NonNullable<SourceFields[Key]> | null,
  ) => void;
}): ReactElement {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <SelectControl
        name="source"
        label="Como chegou à escola"
        value={draft.source ?? "UNSPECIFIED"}
        choices={choices}
        onChange={(value) => {
          const source = leadSourceSchema.safeParse(value);
          change("source", source.success ? source.data : null);
          if (value !== "OTHER") change("sourceDetail", null);
        }}
      />
      {draft.source === "OTHER" && (
        <TextControl
          name="sourceDetail"
          label="Qual origem?"
          placeholder="Ex.: feira de profissões"
          value={draft.sourceDetail ?? ""}
          onChange={(value) => change("sourceDetail", value)}
          error={errors.sourceDetail}
        />
      )}
    </div>
  );
}
