import { createRef } from "react";

import { Checkbox } from "../src/components/checkbox.js";

const checkboxRef = createRef<HTMLElement>();
const checkboxInputRef = createRef<HTMLInputElement>();

export const checkboxWithRef = <Checkbox inputRef={checkboxInputRef} ref={checkboxRef} />;

export const checkboxContract = (
  <>
    <Checkbox
      aria-label="Receber avisos"
      defaultChecked
      name="notifications"
      size="xs"
      value="yes"
    />
    <Checkbox aria-label="Selecionar todas as parcelas" indeterminate invalid />
    <Checkbox aria-label="Contrato aceito" disabled required size="xl" />
  </>
);

// @ts-expect-error Checkbox invalid state is boolean.
export const invalidCheckboxState = <Checkbox invalid="error" />;
