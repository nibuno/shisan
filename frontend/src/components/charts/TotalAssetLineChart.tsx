import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyTotal } from "../../types";
import type { ProjectionPoint } from "../../utils/projection";
import { formatMoney, formatMonthLabel } from "../../utils/format";
import { CHART_THEME } from "../../design/theme";
import { getLineChartScale } from "../../utils/chartScale";

interface Props {
  data: MonthlyTotal[];
  projection?: ProjectionPoint[];
}

interface TooltipPayload {
  value: number;
  name: string;
  dataKey: "actual" | "projection";
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const actual = payload.find((item) => item.dataKey === "actual");
  const item = actual ?? payload[0];
  return (
    <div className="chart-tooltip chart-tooltip-compact">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-value">{formatMoney(item.value)}</p>
      <p className="chart-tooltip-meta">
        {item.dataKey === "actual" ? "実績" : "単純予測"}
      </p>
    </div>
  );
}

export default function TotalAssetLineChart({ data, projection }: Props) {
  const actualByMonth = new Map(data.map((item) => [item.month, Number(item.total)]));
  const projectionByMonth = new Map(
    (projection ?? []).map((item) => [item.month, item.total])
  );
  const months = [...new Set([...actualByMonth.keys(), ...projectionByMonth.keys()])].sort();
  const chartData = months.map((month) => ({
    name: formatMonthLabel(month),
    actual: actualByMonth.get(month) ?? null,
    projection: projectionByMonth.get(month) ?? null,
  }));
  const showProjection = Boolean(projection?.length);

  const valueScale = getLineChartScale(
    chartData.flatMap((row) => [row.actual, row.projection])
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 13, fill: CHART_THEME.tick }}
          tickLine={false}
          axisLine={false}
          tickMargin={CHART_THEME.xTickMargin}
          minTickGap={24}
        />
        <YAxis
          domain={valueScale?.domain}
          ticks={valueScale?.ticks}
          tickFormatter={(v) =>
            new Intl.NumberFormat("ja-JP", {
              notation: "compact",
              currency: "JPY",
            }).format(v)
          }
          tick={{ fontSize: 13, fill: CHART_THEME.tick }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        {showProjection && (
          <Legend
            wrapperStyle={{ fontSize: "var(--font-size-body)", paddingTop: "0.5rem" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="actual"
          name="実績"
          stroke={CHART_THEME.total}
          strokeWidth={2.5}
          dot={{ r: 3, fill: CHART_THEME.total, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
        {showProjection && (
          <Line
            type="monotone"
            dataKey="projection"
            name="予測"
            stroke={CHART_THEME.projection}
            strokeWidth={2.5}
            strokeDasharray="7 5"
            dot={{ r: 3, fill: CHART_THEME.projection, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
