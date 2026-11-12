/* Gráficos reutilizados no painel e nos relatórios (Recharts). */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  fontSize: 12,
};

export function ChartEmpty({ label = "Sem dados para exibir." }: { label?: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
      {label}
    </div>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({ data, centerLabel = "total" }: { data: DonutDatum[]; centerLabel?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);
  if (total === 0) return <ChartEmpty />;

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-navy-900">{total}</span>
          <span className="text-xs text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm" aria-label="Legenda do gráfico">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
              <span className="truncate text-slate-700">{entry.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PriorityBars({ data }: { data: { name: string; total: number; open: number }[] }) {
  if (data.every((d) => d.total === 0)) return <ChartEmpty />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" name="Total" fill="#bfdbfe" radius={[6, 6, 0, 0]} />
          <Bar dataKey="open" name="Em aberto" fill="#1d4e89" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimelineChart({ data }: { data: { label: string; created: number; completed: number }[] }) {
  if (data.every((d) => d.created === 0 && d.completed === 0)) return <ChartEmpty />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4e89" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#1d4e89" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="created" name="Criadas" stroke="#1d4e89" fill="url(#gradCreated)" strokeWidth={2} />
          <Area type="monotone" dataKey="completed" name="Concluídas" stroke="#16a34a" fill="#16a34a" fillOpacity={0.12} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectorBars({ data }: { data: { name: string; pendentes: number; concluidas: number }[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pendentes" name="Pendentes" fill="#f59e0b" radius={[0, 6, 6, 0]} />
          <Bar dataKey="concluidas" name="Concluídas" fill="#16a34a" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
