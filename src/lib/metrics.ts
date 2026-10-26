/* ------------------------------------------------------------------ */
/* Indicadores calculados exclusivamente a partir dos dados presentes */
/* na aplicação (nenhum número arbitrário).                           */
/* ------------------------------------------------------------------ */
import type { HistoryEntry, Material, Priority, ProductionRequest, RequestStatus, Sector, Tone } from "@/types";
import { REQUEST_STATUSES, SECTORS, TERMINAL_STATUSES } from "@/types";
import {
  ACTIVE_STATUSES,
  analyzeAll,
  buildMaterialMetricsMap,
  OPEN_STATUSES,
  STATUS_META,
  type MaterialMetrics,
  type RequestAnalysis,
} from "./businessRules";
import { toDateOnly } from "./utils";

function isTerminalStatus(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface TimelinePoint {
  label: string;
  dateKey: string;
  created: number;
  completed: number;
}

export function buildTimeline(requests: ProductionRequest[], days: number, now = new Date()): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const dateKey = toDateOnly(day);
    points.push({
      dateKey,
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      created: requests.filter((r) => toDateOnly(new Date(r.createdAt)) === dateKey).length,
      completed: requests.filter((r) => r.concludedAt && toDateOnly(new Date(r.concludedAt)) === dateKey).length,
    });
  }
  return points;
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  Pendente: "#94a3b8",
  "Em análise": "#0ea5e9",
  "Aguardando materiais": "#f59e0b",
  "Em separação": "#1d4e89",
  "Pronta para disponibilização": "#0d9488",
  Concluída: "#16a34a",
  Cancelada: "#78716c",
};

export interface DashboardMetrics {
  total: number;
  pending: number;
  inSeparation: number;
  completed: number;
  cancelled: number;
  overdue: number;
  insufficient: number;
  pendingItemsInSeparation: number;
  statusDistribution: { name: RequestStatus; value: number; color: string; tone: Tone }[];
  priorityDistribution: { name: Priority; total: number; open: number }[];
  timeline: TimelinePoint[];
  sectorComparison: { name: Sector; pendentes: number; concluidas: number }[];
  separation: {
    requested: number;
    separated: number;
    pending: number;
    percent: number;
    groups: { name: string; value: number; color: string }[];
  };
  deadlineAlerts: RequestAnalysis[];
  shortageAlerts: { material: Material; metrics: MaterialMetrics }[];
  recentRequests: ProductionRequest[];
  analyses: RequestAnalysis[];
}

export function buildDashboardMetrics(requests: ProductionRequest[], materials: Material[]): DashboardMetrics {
  const analyses = analyzeAll(requests, materials);
  const metricsMap = buildMaterialMetricsMap(materials, requests);

  const countBy = (status: RequestStatus) => requests.filter((r) => r.status === status).length;

  const statusDistribution = REQUEST_STATUSES.map((status) => ({
    name: status,
    value: countBy(status),
    color: STATUS_COLORS[status],
    tone: STATUS_META[status].tone,
  }));

  const priorityDistribution = (["Alta", "Média", "Baixa"] as Priority[]).map((priority) => ({
    name: priority,
    total: requests.filter((r) => r.priority === priority).length,
    open: requests.filter((r) => r.priority === priority && OPEN_STATUSES.includes(r.status)).length,
  }));

  const sectorComparison = SECTORS.map((sector) => ({
    name: sector,
    pendentes: requests.filter((r) => r.sector === sector && OPEN_STATUSES.includes(r.status)).length,
    concluidas: requests.filter((r) => r.sector === sector && r.status === "Concluída").length,
  })).filter((s) => s.pendentes + s.concluidas > 0);

  const validAnalyses = analyses.filter((a) => a.request.status !== "Cancelada");
  const requested = validAnalyses.reduce((sum, a) => sum + a.requested, 0);
  const separated = validAnalyses.reduce((sum, a) => sum + a.separated, 0);
  const pendingAll = analyses
    .filter((a) => ACTIVE_STATUSES.includes(a.request.status))
    .reduce((sum, a) => sum + a.pending, 0);
  const pendingItemsInSeparation = analyses
    .filter((a) => a.request.status === "Em separação")
    .reduce((sum, a) => sum + a.pending, 0);

  const openCount = requests.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const separationCount = countBy("Em separação");
  const readyCount = countBy("Pronta para disponibilização") + countBy("Concluída");

  const deadlineAlerts = analyses
    .filter((a) => ["atrasada", "hoje", "proxima"].includes(a.deadline.state))
    .sort((a, b) => a.deadline.days - b.deadline.days);

  const shortageAlerts = materials
    .map((material) => ({ material, metrics: metricsMap[material.id] }))
    .filter(({ metrics }) => metrics && metrics.status !== "Normal")
    .sort((a, b) => STATUS_SEVERITY[b.metrics.status] - STATUS_SEVERITY[a.metrics.status]);

  return {
    total: requests.length,
    pending: openCount,
    inSeparation: separationCount,
    completed: countBy("Concluída"),
    cancelled: countBy("Cancelada"),
    overdue: analyses.filter((a) => a.deadline.state === "atrasada").length,
    insufficient: analyses.filter((a) => !isTerminalStatus(a.request.status) && a.shortages.length > 0).length,
    pendingItemsInSeparation,
    statusDistribution,
    priorityDistribution,
    timeline: buildTimeline(requests, 14),
    sectorComparison,
    separation: {
      requested,
      separated,
      pending: pendingAll,
      percent: requested === 0 ? 0 : Math.round((separated / requested) * 100),
      groups: [
        { name: "Não iniciadas", value: openCount, color: "#f59e0b" },
        { name: "Em separação", value: separationCount, color: "#1d4e89" },
        { name: "Prontas ou concluídas", value: readyCount, color: "#16a34a" },
        { name: "Canceladas", value: countBy("Cancelada"), color: "#78716c" },
      ],
    },
    deadlineAlerts,
    shortageAlerts,
    recentRequests: [...requests]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    analyses,
  };
}

const STATUS_SEVERITY: Record<MaterialMetrics["status"], number> = {
  Normal: 0,
  Baixo: 1,
  Insuficiente: 2,
  Indisponível: 3,
};

export interface ReportMetrics {
  total: number;
  completed: number;
  cancelled: number;
  pending: number;
  overdue: number;
  onTimeRate: number | null;
  avgServiceHours: number | null;
  insufficientRequests: number;
  statusDistribution: { name: RequestStatus; value: number; color: string }[];
  timeline: TimelinePoint[];
  byResponsible: { name: string; total: number; completed: number; onTime: number; late: number }[];
  shortageMaterials: { material: Material; metrics: MaterialMetrics }[];
  historyByActor: { name: string; total: number }[];
}

export function buildReportMetrics(
  requests: ProductionRequest[],
  materials: Material[],
  history: HistoryEntry[],
  periodDays: number | null,
  now = new Date(),
): ReportMetrics {
  const since = periodDays === null ? 0 : now.getTime() - periodDays * 86_400_000;
  const inPeriod = requests.filter((r) => new Date(r.createdAt).getTime() >= since);
  const analyses = analyzeAll(inPeriod, materials);
  const concluded = inPeriod.filter((r) => r.status === "Concluída");
  const onTime = concluded.filter((r) => r.concludedAt && toDateOnly(new Date(r.concludedAt)) <= r.dueDate);
  const serviceHours = concluded
    .filter((r) => r.concludedAt)
    .map((r) => (new Date(r.concludedAt as string).getTime() - new Date(r.createdAt).getTime()) / 3_600_000);

  const responsibles = [...new Set(inPeriod.map((r) => r.responsible))].sort();
  const byResponsible = responsibles.map((name) => {
    const mine = inPeriod.filter((r) => r.responsible === name);
    const done = mine.filter((r) => r.status === "Concluída");
    const ok = done.filter((r) => r.concludedAt && toDateOnly(new Date(r.concludedAt)) <= r.dueDate);
    return { name, total: mine.length, completed: done.length, onTime: ok.length, late: done.length - ok.length };
  });

  const metricsMap = buildMaterialMetricsMap(materials, requests);
  const shortageMaterials = materials
    .map((material) => ({ material, metrics: metricsMap[material.id] }))
    .filter(({ metrics }) => metrics && (metrics.shortfall > 0 || metrics.status === "Indisponível"));

  const actorCounts = new Map<string, number>();
  history
    .filter((h) => new Date(h.timestamp).getTime() >= since)
    .forEach((h) => actorCounts.set(h.actor, (actorCounts.get(h.actor) ?? 0) + 1));

  return {
    total: inPeriod.length,
    completed: concluded.length,
    cancelled: inPeriod.filter((r) => r.status === "Cancelada").length,
    pending: inPeriod.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    overdue: analyses.filter((a) => a.deadline.state === "atrasada").length,
    onTimeRate: concluded.length === 0 ? null : Math.round((onTime.length / concluded.length) * 100),
    avgServiceHours:
      serviceHours.length === 0 ? null : serviceHours.reduce((s, h) => s + h, 0) / serviceHours.length,
    insufficientRequests: analyses.filter((a) => !isTerminalStatus(a.request.status) && a.shortages.length > 0).length,
    statusDistribution: REQUEST_STATUSES.map((status) => ({
      name: status,
      value: inPeriod.filter((r) => r.status === status).length,
      color: STATUS_COLORS[status],
    })),
    timeline: buildTimeline(inPeriod, periodDays && periodDays <= 31 ? periodDays : 30, now),
    byResponsible,
    shortageMaterials,
    historyByActor: [...actorCounts.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
  };
}
