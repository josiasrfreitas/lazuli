import { createRef } from "react";

import { Field, FieldDescription, FieldError } from "../src/components/field.js";
import { Input } from "../src/components/input.js";
import { Label } from "../src/components/label.js";

const fieldRef = createRef<HTMLDivElement>();

export const fieldWithRef = (
  <Field ref={fieldRef}>
    <Label>Email institucional</Label>
    <Input type="email" />
  </Field>
);

export const fieldContract = (
  <Field disabled name="email">
    <Label>Email institucional</Label>
    <Input type="email" />
    <FieldDescription>Enviamos um link de acesso para este endereço.</FieldDescription>
    <FieldError match>Acesso não autorizado. Fale com a secretaria.</FieldError>
  </Field>
);

export const fieldErrorMatchesValidity = (
  <FieldError match="valueMissing">Informe o email.</FieldError>
);

// @ts-expect-error `match` accepts a boolean or a ValidityState key.
export const fieldErrorWithInvalidMatch = <FieldError match="notAValidityKey">Erro.</FieldError>;
