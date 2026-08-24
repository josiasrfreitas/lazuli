import { createRef } from "react";

import { Textarea } from "../src/components/textarea.js";

const textareaRef = createRef<HTMLTextAreaElement>();

export const textareaWithRef = <Textarea ref={textareaRef} rows={4} />;

export const textareaContract = (
  <>
    <Textarea aria-describedby="student-notes-hint" placeholder="Adicione observações" />
    <Textarea defaultValue="Responsável prefere contato por WhatsApp." invalid required />
    <Textarea disabled placeholder="Observações indisponíveis" />
    <Textarea defaultValue="ID do aluno: 2026-001" readOnly />
  </>
);

// @ts-expect-error Textarea invalid state is boolean.
export const invalidTextareaState = <Textarea invalid="error" />;
