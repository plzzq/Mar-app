import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarX, CircleCheck, ClipboardList, Clock, PackageOpen, PackageX, Plus, Warehouse } from "lucide-react";
import { DonutChart, PriorityBars, SectorBars, TimelineChart } from "@/components/charts/DashboardCharts";
import { DeadlineBadge, HistoryKindBadge, StockStatusBadge } from "@/components/common/DomainBadges";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge, KpiCard, ShortageAlert, type ShortageItem } from "@/components/common/Widgets";
import { RequestCards, RequestTable } from "@/components/requests/RequestList";
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, Progress, buttonClasses } from "@/components/ui";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@/hooks/useQuery";
import type { RequestAnalysis } from "@/lib/businessRules";
import { buildDashboardMetrics } from "@/lib/metrics";
import { formatDateOnly, formatDateTime } from "@/lib/utils";
import { listHistory } from "@/services/activityService";
import { listMaterials } from "@/services/stockService";
import { listRequests } from "@/services/requestsService";

export function DashboardPage() {
  const { data, loading, error, refetch } = useQuery(async () => {
    const [requests, materials, history] = await Promise.all([listRequests(), listMaterials(), listHistory()]);
    return { requests, materials, history };
  });
  const { can } = usePermissions();

  const metrics = useMemo(() => (data ? buildDashboardMetrics(data.requests, data.materials) : null), [data]);

  const header = (
    <>
      <div className="mb-3">
        <DemoBadge />
      </div>
      <PageHeader
        title="Visão geral"
        description="Situação operacional das solicitações, do estoque e da separação de materiais."
        actions={
          <>
            {can("request.create") && (
              <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova solicitação
              </Link>
            )}
            <Link to="/estoque" className={buttonClasses("outline")}>
              <Warehouse className="h-4 w-4" aria-hidden="true" />
              Consultar estoque
            </Link>
          </>
        }
      />
    </>
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label="Calculando indicadores a partir dos dados…" rows={5} />
      </>
    );
  }

  if (error || !metrics || !data) {
    return (
      <>
        {header}
        <ErrorState message={error?.message} onRetry={refetch} />
      </>
    );
  }

  const recent: RequestAnalysis[] = [...metrics.analyses]
    .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
    .slice(0, 6);

  const shortageItems: ShortageItem[] = metrics.shortageAlerts
    .filter(({ metrics: m }) => m.status === "Insuficiente" || m.status === "Indisponível")
    .map(({ material, metrics: m }) => ({
      key: material.id,
      name: `${material.code} · ${material.name}`,
      unit: material.unit,
      required: m.reserved + m.openDemand,
      available: m.available,
      difference: m.shortfall,
      to: `/estoque/${material.id}`,
    }));

  const lowStock = metrics.shortageAlerts.filter(({ metrics: m }) => m.status === "Baixo");

  return (
    <>
      {header}

      <section aria-labelledby="kpi-title" className="mb-6">
        <h2 id="kpi-title" className="sr-only">
          Indicadores principais
        </h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-6">
          <KpiCard label="Total de solicitações" value={metrics.total} icon={ClipboardList} hint="Cadastradas na demonstração" to="/solicitacoes" />
          <KpiCard label="Demandas pendentes" value={metrics.pending} icon={Clock} tone="warning" hint="Pendentes, em análise ou aguardando materiais" to="/solicitacoes" />
          <KpiCard label="Materiais em separação" value={metrics.inSeparation} icon={PackageOpen} tone="primary" hint={`${metrics.pendingItemsInSeparation} unid. ainda a separar`} to="/separacao" />
          <KpiCard label="Solicitações concluídas" value={metrics.completed} icon={CircleCheck} tone="success" hint="Materiais entregues à produção" to="/solicitacoes" />
          <KpiCard label="Demandas atrasadas" value={metrics.overdue} icon={CalendarX} tone="danger" hint="Prazo vencido e não concluídas" to="/solicitacoes" />
          <KpiCard label="Estoque insuficiente" value={metrics.insufficient} icon={PackageX} tone="danger" hint="Solicitações com falta de material" to="/estoque" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Demandas por status" description="Distribuição atual das solicitações cadastradas" icon={ClipboardList} />
          <div className="p-5">
            <DonutChart
              data={metrics.statusDistribution.map((d) => ({ name: d.name, value: d.value, color: d.color }))}
              centerLabel="solicitações"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Situação geral da separação"
            description={`${metrics.separation.separated} de ${metrics.separation.requested} unidades já separadas`}
            icon={PackageOpen}
          />
          <div className="space-y-5 p-5">
            <Progress value={metrics.separation.percent} label="Unidades separadas" />
            <DonutChart data={metrics.separation.groups} centerLabel="solicitações" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Evolução das solicitações" description="Criadas e concluídas nos últimos 14 dias" />
          <div className="p-5">
            <TimelineChart data={metrics.timeline} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Solicitações por prioridade" description="Total e quantidade em aberto" />
          <div className="p-5">
            <PriorityBars data={metrics.priorityDistribution} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Concluídas e pendentes por setor" description="Comparação entre tarefas concluídas e em aberto" />
          <div className="p-5">
            <SectorBars data={metrics.sectorComparison} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Alertas de prazos"
            description="Solicitações vencidas ou com prazo nos próximos dias"
            icon={Clock}
            actions={<Link to="/solicitacoes?ordem=prazo" className="text-sm font-medium text-navy-700 hover:underline">Ver todas</Link>}
          />
          <div className="p-5">
            {metrics.deadlineAlerts.length === 0 ? (
              <EmptyState title="Nenhum prazo em alerta" description="Não há solicitações vencidas ou com prazo próximo." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {metrics.deadlineAlerts.slice(0, 8).map((a) => (
                  <li key={a.request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link to={`/solicitacoes/${a.request.id}`} className="font-semibold text-navy-800 hover:underline">
                        {a.request.code}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {a.request.description} · {a.request.responsible}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <DeadlineBadge state={a.deadline.state} days={a.deadline.days} />
                      <span className="text-xs text-slate-500">{formatDateOnly(a.request.dueDate)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Solicitações recentes" description="Últimas solicitações cadastradas" icon={ClipboardList} />
            <div className="p-4 md:p-5">
              <RequestTable items={recent} />
              <RequestCards items={recent} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Avisos de materiais" description="Itens insuficientes, indisponíveis ou abaixo do mínimo" icon={PackageX} />
            <div className="space-y-4 p-5">
              {shortageItems.length > 0 ? (
                <ShortageAlert items={shortageItems} title="Materiais insuficientes ou indisponíveis" />
              ) : (
                <p className="text-sm text-slate-600">Nenhum material insuficiente ou indisponível no momento.</p>
              )}
              {lowStock.length > 0 && (
                <ul className="space-y-2">
                  {lowStock.map(({ material, metrics: m }) => (
                    <li key={material.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link to={`/estoque/${material.id}`} className="truncate font-medium text-navy-800 hover:underline">
                        {material.code} · {material.name}
                      </Link>
                      <StockStatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividades recentes" description="Registros de demonstração (não são auditoria)" />
            <div className="p-5">
              {data.history.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma atividade registrada.</p>
              ) : (
                <ul className="space-y-4">
                  {data.history.slice(0, 6).map((h) => (
                    <li key={h.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-700" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">{h.action}</span>
                          {h.requestCode && <span className="text-slate-600"> · {h.requestCode}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {h.actor} · {formatDateTime(h.timestamp)}
                        </p>
                        <div className="mt-1">
                          <HistoryKindBadge kind={h.kind} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
