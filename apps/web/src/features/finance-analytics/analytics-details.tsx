import { type ReactElement } from "react";
import type { Analytics } from "./chart-shared";
import { OverdueStudents } from "./overdue-students";
import { AgingChart, PaymentMethodsChart } from "./distribution-charts";

export function AnalyticsDetails({ data }: { data: Analytics }): ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AgingChart data={data} />
        <PaymentMethodsChart data={data} />
      </div>
      <OverdueStudents />
    </div>
  );
}
