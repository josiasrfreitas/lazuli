import { createRef } from "react";

import { Field } from "../src/components/field.js";
import { FormRow, FormSection } from "../src/components/form-layout.js";
import { Input } from "../src/components/input.js";
import { Label } from "../src/components/label.js";

const sectionRef = createRef<HTMLFieldSetElement>();
const rowRef = createRef<HTMLDivElement>();

export const formLayoutWithRefs = (
  <FormSection description="Opcional para adultos." ref={sectionRef} title="Responsável">
    <FormRow columns={2} ref={rowRef}>
      <Field>
        <Label>Telefone</Label>
        <Input placeholder="(11) 99999-9999" size="sm" type="tel" />
      </Field>
      <Field>
        <Label>Email</Label>
        <Input placeholder="nome@exemplo.com" size="sm" type="email" />
      </Field>
    </FormRow>
  </FormSection>
);

export const formSectionWithAction = (
  <FormSection action={<button type="button">Adicionar</button>} title="Endereço" />
);

// @ts-expect-error A section always has a visible title.
export const formSectionWithoutTitle = <FormSection />;

// @ts-expect-error Rows support one to three equal columns; use a class for other tracks.
export const formRowWithFourColumns = <FormRow columns={4} />;
