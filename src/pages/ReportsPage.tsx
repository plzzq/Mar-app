import { useMemo, useState } from "react";
import { BarChart3, CalendarCheck, CircleCheck, Clock, Download, PackageX, Timer } from "lucide-react";
import { DonutChart, TimelineChart } from "@/components/charts/DashboardCharts";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge, KpiCard, ShortageAlert, type ShortageItem } from "@/components/common/Widgets";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { buildReportMetrics } from "@/lib/metrics";
import { downloadCsv, formatNumber, formatPercent } from "@/lib/utils";
import { listHistory } from "@/services/activityService";
import { listRequests } from "@/services/requestsService";
import { listMaterials } from "@/services/stockService";

type Period = "7" | "30" | "90" | "todos";

const PERIOD_LABEL: Record<Period, string> = {
  "7": "últimos 7 dias",
  "30": "últimos 30 dias",
  "90": "últimos 90 dias",
  todos: "todo o período",
};

function formatServiceTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${formatNumber(hours, 1)} h`;
  return `${formatNumber(hours / 24, 1)} dias`;
}

export function ReportsPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>("30");

  const { data, loading, error, refetch } = useQuery(async () => {
    const [requests, materials, history] = await Promise.all([listRequests(), listMaterials(), listHistory()]);
    return { requests, materials, history };
  });

  const report = useMemo(
    () => (data ? buildReportMetrics(data.requests, data.materials, data.history, period === "todos" ? null : Number(period)) : null),
    [data, period],
  );

  const exportCsv = () => {
    if (!report) return;
    const rows: (string | number)[][] = [
      ["Responsável", "Solicitações", "Concluídas", "No prazo", "Fora do prazo"],
      ...report.byResponsible.map((r) => [r.name, r.total, r.completed, r.onTime, r.late]),
    ];
    downloadCsv(`relatorio-responsaveis-${period}.csv`, rows);
    toast({ title: "Relatório exportado", description: "Tabela de desempenho por responsável.", variant: "success" });
  };

  const header = (
    <>
      <div className="mb-3">
        <DemoBadge />
      </div>
      <PageHeader
        title="Relatórios e indicadores"
        description="Desempenho das solicitações, cumprimento de prazos e situação do estoque. Todos os valores são calculados a partir dos dados de demonstração."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Relatórios" }]}
        actions={
          <>
            <div className="w-44">
              <Select id="report-period" label="Período" value={period} onChange={(e) => setPeriod(e.target.value as Period)} wrapperClassName="space-y-0">
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="todos">Todo o período</option>
              </Select>
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!report || report.byResponsible.length === 0} className="self-end">
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
          </>
        }
      />
    </>
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label="Calculando indicadores…" rows={5} />
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        {header}
        <ErrorState message={error?.message} onRetry={refetch} />
      </>
    );
  }

  const shortageItems: ShortageItem[] = report.shortageMaterials
    .filter(({ metrics }) => metrics.shortfall > 0)
    .map(({ material, metrics }) => ({
      key: material.id,
      name: `${material.code} · ${material.name}`,
      unit: material.unit,
      required: metrics.reserved + metrics.openDemand,
      available: metrics.available,
      difference: metrics.shortfall,
      to: `/estoque/${material.id}`,
    }));

  const periodText = PERIOD_LABEL[period];

  return (
    <>
      {header}

      <section aria-label="Indicadores do período" className="mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-6">
        <KpiCard label="Solicitações" value={report.total} hint={`Criadas nos ${periodText}`} icon={BarChart3} />
        <KpiCard label="Concluídas" value={report.completed} hint="No período" icon={CircleCheck} tone="success" />
        <KpiCard label="Pendentes" value={report.pending} hint="Ainda em aberto" icon={Clock} tone="warning" />
        <KpiCard
          label="Cumprimento de prazos"
          value={report.onTimeRate === null ? "—" : formatPercent(report.onTimeRate)}
          hint="Concluídas até o prazo"
          icon={CalendarCheck}
          tone="info"
        />
        <KpiCard label="Tempo de atendimento" value={formatServiceTime(report.avgServiceHours)} hint="Média entre criação e conclusão" icon={Timer} tone="primary" />
        <KpiCard label="Com falta de material" value={report.insufficientRequests} hint="Solicitações em aberto" icon={PackageX} tone="danger" />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Criadas e concluídas por dia" description="Últimos 30 dias ou período selecionado" />
          <div className="p-5">
            <TimelineChart data={report.timeline} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Situação das solicitações" description={`Distribuição no ${periodText}`} />
          <div className="p-5">
            <DonutChart data={report.statusDistribution} centerLabel="no período" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Desempenho por responsável" description="Concluídas no prazo e fora do prazo" />
          {report.byResponsible.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Sem solicitações no período" description="Altere o período para visualizar o desempenho por responsável." />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Desempenho por responsável no período</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Responsável</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Solicitações</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Concluídas</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">No prazo</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Fora do prazo</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">% no prazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.byResponsible.map((r) => (
                      <tr key={r.name}>
                        <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.total}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.onTime}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.late > 0 ? <Badge tone="danger">{r.late}</Badge> : 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.completed === 0 ? "—" : formatPercent((r.onTime / r.completed) * 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-slate-100 lg:hidden">
                {report.byResponsible.map((r) => (
                  <li key={r.name} className="space-y-2 p-4">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge tone="neutral">{r.total} solicitações</Badge>
                      <Badge tone="success">{r.onTime} no prazo</Badge>
                      {r.late > 0 && <Badge tone="danger">{r.late} fora do prazo</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Estoque insuficiente" description="Materiais com demanda acima do disponível" icon={PackageX} />
            <div className="space-y-3 p-5">
              {shortageItems.length > 0 ? (
                <ShortageAlert items={shortageItems} title="Diferença entre necessário e disponível" />
              ) : (
                <p className="text-sm text-slate-600">Nenhum material com falta na situação atual.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Atividade registrada" description="Registros de demonstração por responsável" />
            <ul className="space-y-2 p-5 text-sm">
              {report.historyByActor.length === 0 && <li className="text-slate-500">Nenhum registro no período.</li>}
              {report.historyByActor.slice(0, 6).map((h) => (
                <li key={h.name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-slate-700">{h.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{h.total}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <p className="mt-6 rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
        Relatórios de demonstração. Os números dependem dos dados fictícios e das ações realizados nesta sessão e não constituem registro de auditoria.
        Exportações futuras poderão ser ligadas ao backend sem alterar esta tela.
      </p>
    </>
  );
}
