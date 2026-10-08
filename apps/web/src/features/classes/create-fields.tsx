"use client";
import type { ReactElement } from "react";
import { FormSection } from "@lazuli/ui";
import { OrganizationFields } from "./create-organization";
import { ScheduleFields } from "./create-schedule";
import type { ClassDraft, ClassOptions } from "./create-model";

export { initialClassDraft } from "./create-model";
export type { ClassDraft } from "./create-model";

export type ClassFieldsProps = {
  draft: ClassDraft;
  change: <K extends keyof ClassDraft>(field: K, value: ClassDraft[K]) => void;
  options: ClassOptions;
  errors: Record<string, string>;
};

export function ClassCreateFields(props: ClassFieldsProps): ReactElement {
  return (
    <div className="space-y-5">
      <FormSection title="Organização">
        <OrganizationFields {...props} />
      </FormSection>
      <FormSection title="Horário e capacidade">
        <ScheduleFields {...props} />
      </FormSection>
    </div>
  );
}
