import type { ReactElement } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRLFromCents } from "~/lib/format";
import { compactMoney, monthLabel } from "./contract-closings-model";
import type { RouterOutputs } from "@lazuli/api";

export type Analytics = RouterOutputs["finance"]["analytics"];
export type CashMonth = Analytics["months"][number];

const MONTH_KEY_LENGTH = 7;
const YEAR_LENGTH = 4;
const CHART_HEIGHT = 280;
const CORNER_RADIUS = 3;
const AXIS_PROPS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
};
function CashTooltip({
  active,
  payload,
}: {
  active?: boolean | undefined;
  payload?:
    | readonly { payload?: Omit<CashMonth, "receivedCents"> & { receivedCents: number | null } }[]
    | undefined;
}): ReactElement | null {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="grid gap-2 rounded-sm border border-border bg-popover p-3 text-caption text-popover-foreground shadow-md">
      <p className="font-semibold capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, YEAR_LENGTH)}
      </p>
      <p>Cobranças: {formatBRLFromCents(row.expectedCents)}</p>
      <p>Recebido: {row.receivedCents === null ? "—" : formatBRLFromCents(row.receivedCents)}</p>
    </div>
  );
}

export function RevenueChart({ data }: { data: Analytics }): ReactElement {
  const months = data.months.map((month) => ({
    ...month,
    receivedCents: month.month > data.asOf.slice(0, MONTH_KEY_LENGTH) ? null : month.receivedCents,
  }));
  return (
    <div className="min-w-0 space-y-4">
      <CashLegend />
      <div
        className="min-w-0"
        role="img"
        aria-label={`Cobranças por vencimento e recebimentos por pagamento em ${data.year}. Valores exatos disponíveis na opção Tabela.`}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <ComposedChart
            data={months}
            margin={{ top: 16, right: 12, left: 0, bottom: 8 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis {...AXIS_PROPS} dataKey="month" tickFormatter={monthLabel} />
            <YAxis {...AXIS_PROPS} tickFormatter={compactMoney} width={52} />
            <Tooltip
              content={<CashTooltip />}
              cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            />
            <Bar
              dataKey="expectedCents"
              name="Cobranças"
              fill="var(--info)"
              fillOpacity={0.65}
              radius={[CORNER_RADIUS, CORNER_RADIUS, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Line
              dataKey="receivedCents"
              name="Recebido"
              type="monotone"
              stroke="var(--success)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CashLegend(): ReactElement {
  return (
    <div className="flex flex-wrap gap-5 text-caption text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-info" />
        Cobranças (barras)
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-4 bg-success" />
        Recebido (linha)
      </span>
    </div>
  );
}
