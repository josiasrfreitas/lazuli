import { Button } from "@lazuli/ui";
import type { ReactElement } from "react";

export function QueryNotice({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}): ReactElement {
  return failed ? (
    <div role="alert">
      Não foi possível carregar os dados.{" "}
      <Button variant="ghost" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  ) : (
    <p role="status">Carregando indicadores…</p>
  );
}
