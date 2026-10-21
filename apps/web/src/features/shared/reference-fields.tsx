import type { ReactElement } from "react";
import { FormRow } from "@lazuli/ui";
import { TextControl } from "~/features/classes/form-controls";
type ReferenceDraft = { reference: string; pageFrom: string; pageTo: string };
type Props = {
  prefix?: string;
  value: ReferenceDraft;
  errors: Record<string, string>;
  change: (name: keyof ReferenceDraft, value: string) => void;
};
const PAGE_FIELDS = ["pageFrom", "pageTo"] as const;
export function ReferenceFields({ prefix = "", value, errors, change }: Props): ReactElement {
  const name = (key: keyof ReferenceDraft): string => (prefix ? `${prefix}-${key}` : key);
  const filled = Boolean(value.reference || value.pageFrom || value.pageTo);
  const invalid = ["reference", ...PAGE_FIELDS].some((key) =>
    Boolean(errors[prefix ? `${prefix}-${key}` : key]),
  );
  return (
    <details className="rounded-md border border-border p-3" open={filled || invalid || undefined}>
      <summary className="cursor-pointer text-caption font-medium">
        Lição e páginas · opcionais
      </summary>
      <div className="mt-3 grid gap-3">
        <TextControl
          name={name("reference")}
          label="Lição ou referência"
          placeholder="Ex.: Unit 3 · Student’s Book"
          value={value.reference}
          onChange={(next) => change("reference", next)}
          error={errors[name("reference")]}
        />
        <FormRow columns={2} className="w-fit">
          {PAGE_FIELDS.map((key) => (
            <div className="w-28" key={key}>
              <TextControl
                name={name(key)}
                label={key === "pageFrom" ? "Página inicial" : "Página final"}
                inputMode="numeric"
                placeholder={key === "pageFrom" ? "Ex.: 24" : "Ex.: 27"}
                value={value[key]}
                onChange={(next) => change(key, next)}
                error={errors[name(key)]}
              />
            </div>
          ))}
        </FormRow>
      </div>
    </details>
  );
}
