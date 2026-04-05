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
import type { TrendPoint } from "../types";

interface TrendChartProps {
  data: TrendPoint[];
  title?: string;
  height?: number;
}

const lineConfig = [
  { dataKey: "overall", stroke: "#16a34a", name: "Overall" },
  { dataKey: "physical", stroke: "#3b82f6", name: "Physical" },
  { dataKey: "emotional", stroke: "#a855f7", name: "Emotional" },
  { dataKey: "social", stroke: "#ec4899", name: "Social" },
];

export default function TrendChart({
  data,
  title = "Wellbeing Trends",
  height = 300,
}: TrendChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">{title}</h3>
      <div
        role="img"
        aria-label={`${title} line chart showing wellbeing scores over time`}
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {lineConfig.map((cfg) => (
              <Line
                key={cfg.dataKey}
                type="monotone"
                dataKey={cfg.dataKey}
                stroke={cfg.stroke}
                name={cfg.name}
                strokeWidth={cfg.dataKey === "overall" ? 2.5 : 1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
