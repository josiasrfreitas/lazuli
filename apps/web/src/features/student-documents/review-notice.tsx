import type { ReactElement } from "react";
import { Alert } from "@lazuli/ui";
export function DocumentReviewNotice(): ReactElement {
  return (
    <Alert variant="info">
      <strong>Confira antes de salvar</strong>
      <p>
        A leitura automática pode conter erros. Revise os dados preenchidos e os anexos com os
        documentos originais.
      </p>
    </Alert>
  );
}
