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
import type { AssetTotal } from "../../types";
import { formatMoney, formatMonthLabel } from "../../utils/format";
import { CHART_THEME, getChartSeriesColor } from "../../design/theme";
import { getLineChartScale } from "../../utils/chartScale";

interface Props {
  data: AssetTotal[];
}

type PivotedRow = { name: string } & Record<string, string | number | null>;

interface AssetSeries {
  id: number;
  key: string;
  label: string;
}

function buildChartData(data: AssetTotal[]): {
  rows: PivotedRow[];
  series: AssetSeries[];
} {
  const assetMap = new Map<number, AssetTotal>();
  data.forEach((item) => assetMap.set(item.asset_id, item));

  const assets = [...assetMap.values()].sort((a, b) => a.asset_id - b.asset_id);
  const nameCounts = new Map<string, number>();
  assets.forEach((asset) => {
    nameCounts.set(asset.asset_name, (nameCounts.get(asset.asset_name) ?? 0) + 1);
  });
  const series = assets.map((asset) => ({
    id: asset.asset_id,
    key: `asset_${asset.asset_id}`,
    label:
      (nameCounts.get(asset.asset_name) ?? 0) > 1
        ? `${asset.asset_name}（${asset.owner_name}）`
        : asset.asset_name,
  }));

  const months = [...new Set(data.map((item) => item.month))].sort();
  const rows = months.map((month) => {
    const row: PivotedRow = { name: formatMonthLabel(month) };
    series.forEach((asset) => {
      const found = data.find(
        (item) => item.month === month && item.asset_id === asset.id
      );
      row[asset.key] = found ? Number(found.total) : null;
    });
    return row;
  });

  return { rows, series };
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
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
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="chart-tooltip-row">
          <span style={{ color: item.color }}>{item.name}</span>
          <span>{formatMoney(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AssetLineChart({ data }: Props) {
  if (!data.length) {
    return <div className="empty-state">データがありません</div>;
  }
  const { rows, series } = buildChartData(data);
  const valueScale = getLineChartScale(
    rows.flatMap((row) =>
      series.map((asset) => {
        const value = row[asset.key];
        return typeof value === "number" ? value : null;
      })
    )
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 13, fill: CHART_THEME.tick }}
          tickLine={false}
          axisLine={false}
          tickMargin={CHART_THEME.xTickMargin}
        />
        <YAxis
          domain={valueScale?.domain}
          ticks={valueScale?.ticks}
          tickFormatter={(value) =>
            new Intl.NumberFormat("ja-JP", { notation: "compact" }).format(value)
          }
          tick={{ fontSize: 13, fill: CHART_THEME.tick }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "var(--font-size-body)", paddingTop: "0.5rem" }}
        />
        {series.map((asset) => (
          <Line
            key={asset.id}
            type="monotone"
            dataKey={asset.key}
            name={asset.label}
            stroke={getChartSeriesColor(asset.id)}
            strokeWidth={2}
            dot={{
              r: 3,
              fill: getChartSeriesColor(asset.id),
              strokeWidth: 0,
            }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
