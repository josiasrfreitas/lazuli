import type { CSSProperties, ReactElement } from "react";

import type { ContractRow } from "./contract-columns";

const PERCENT = 100;

export function ContractPaymentProgress({
  progress,
}: {
  progress: ContractRow["paymentProgress"];
}): ReactElement {
  const { paid, total, waived, cancelled } = progress;
  const label = `${paid} de ${total} pagas`;
  const exceptions = [
    waived > 0 ? `${waived} ${waived === 1 ? "dispensada" : "dispensadas"}` : null,
    cancelled > 0 ? `${cancelled} ${cancelled === 1 ? "cancelada" : "canceladas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <span aria-hidden="true" className="font-numeric whitespace-nowrap">
        {label}
      </span>
      <div
        role="progressbar"
        aria-label="Parcelas pagas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-valuetext={exceptions ? `${label}; ${exceptions}` : label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full w-(--payment-progress) rounded-full bg-interactive"
          style={{ "--payment-progress": `${(paid / total) * PERCENT}%` } as CSSProperties}
        />
      </div>
      {exceptions ? (
        <span aria-hidden="true" className="text-micro whitespace-normal text-muted-foreground">
          {exceptions}
        </span>
      ) : null}
    </div>
  );
}
