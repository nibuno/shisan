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
import type { CategoryTotal, Category } from "../../types";
import { formatMoney, formatMonthLabel } from "../../utils/format";
import { CHART_THEME, getAssetCategoryColor } from "../../design/theme";
import { getLineChartScale } from "../../utils/chartScale";

interface Props {
  data: CategoryTotal[];
  categories: Category[];
}

type PivotedRow = { name: string } & Record<string, string | number>;

function pivotData(data: CategoryTotal[], categories: Category[]): PivotedRow[] {
  const months = [...new Set(data.map((d) => d.month))].sort();
  return months.map((month) => {
    const row: PivotedRow = { name: formatMonthLabel(month) };
    categories.forEach((cat) => {
      const found = data.find(
        (d) => d.month === month && d.category_id === cat.id
      );
      row[cat.name] = found ? Number(found.total) : 0;
    });
    return row;
  });
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
      {payload.map((p) => (
        <div key={p.name} className="chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CategoryLineChart({ data, categories }: Props) {
  if (!data.length) {
    return <div className="empty-state">データがありません</div>;
  }
  const chartData = pivotData(data, categories);

  const valueScale = getLineChartScale(
    chartData.flatMap((row) =>
      categories.map((cat) => {
        const value = row[cat.name];
        return typeof value === "number" ? value : null;
      })
    )
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
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
          tickFormatter={(v) =>
            new Intl.NumberFormat("ja-JP", { notation: "compact" }).format(v)
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
        {categories.map((cat) => (
          <Line
            key={cat.id}
            type="monotone"
            dataKey={cat.name}
            stroke={getAssetCategoryColor(cat.name, cat.id)}
            strokeWidth={2}
            dot={{ r: 3, fill: getAssetCategoryColor(cat.name, cat.id), strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
