import { useState, type ReactElement } from "react";
import type { Analytics } from "./chart-shared";
import { AgingChart, PaymentMethodsChart } from "./distribution-charts";

export function AnalyticsDetails({ data }: { data: Analytics }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Detalhar atrasos e meios de pagamento
      </summary>
      {expanded && (
        <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-2">
          <AgingChart data={data} />
          <PaymentMethodsChart data={data} />
        </div>
      )}
    </details>
  );
}
