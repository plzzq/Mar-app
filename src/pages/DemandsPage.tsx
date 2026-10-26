import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Factory, Plus, Search } from "lucide-react";
import { DeadlineBadge, PriorityBadge } from "@/components/common/DomainBadges";
import { FilterPanel } from "@/components/common/FilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { MiniProgress } from "@/components/requests/RequestList";
import { Card, EmptyState, ErrorState, LoadingState, buttonClasses } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useQuery } from "@/hooks/useQuery";
import type { RequestAnalysis } from "@/lib/businessRules";
import { STATUS_META } from "@/lib/businessRules";
import { cn, formatShortDate, normalizeText } from "@/lib/utils";
import { listRequestAnalyses } from "@/services/requestsService";
import { PRIORITIES, REQUEST_STATUSES, SECTORS, type Priority, type RequestStatus, type Sector } from "@/types";

/** Etapas do fluxo exibidas no quadro (Cancelada tem faixa própria abaixo). */
const FLOW_STATUSES: RequestStatus[] = REQUEST_STATUSES.filter((s) => s !== "Cancelada");

const COLUMN_ACCENT: Record<RequestStatus, string> = {
  Pendente: "border-t-slate-400",
  "Em análise": "border-t-sky-500",
  "Aguardando materiais": "border-t-amber-500",
  "Em separação": "border-t-blue-700",
  "Pronta para disponibilização": "border-t-teal-600",
  Concluída: "border-t-emerald-600",
  Cancelada: "border-t-stone-500",
};

export function DemandsPage() {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<Sector | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const { data, loading, error, refetch } = useQuery(listRequestAnalyses);

  const columns = useMemo(() => {
    const term = normalizeText(search);
    const filtered = (data ?? []).filter(({ request: r }) => {
      if (term && !normalizeText(`${r.code} ${r.description} ${r.responsible}`).includes(term)) return false;
      if (sector && r.sector !== sector) return false;
      if (priority && r.priority !== priority) return false;
      return true;
    });
    return FLOW_STATUSES.map((status) => ({
      status,
      items: filtered
        .filter((a) => a.request.status === status)
        .sort((a, b) => a.request.dueDate.localeCompare(b.request.dueDate)),
    }));
  }, [data, search, sector, priority]);

  const total = columns.reduce((sum, c) => sum + c.items.length, 0);
  const cancelledCount = (data ?? []).filter(({ request: r }) => {
    if (r.status !== "Cancelada") return false;
    const term = normalizeText(search);
    if (term && !normalizeText(`${r.code} ${r.description} ${r.responsible}`).includes(term)) return false;
    if (sector && r.sector !== sector) return false;
    if (priority && r.priority !== priority) return false;
    return true;
  }).length;

  return (
    <>
      <PageHeader
        title="Demandas de produção"
        description="Acompanhe o fluxo das demandas por etapa, do cadastro à conclusão. Cada cartão corresponde a uma solicitação de materiais."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Demandas de produção" }]}
        actions={
          <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova demanda
          </Link>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <FilterPanel
          activeCount={(search ? 1 : 0) + (sector ? 1 : 0) + (priority ? 1 : 0)}
          contentClassName="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]"
        >
        <div>
          <label htmlFor="demand-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Pesquisar demanda
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="demand-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, descrição ou responsável"
              className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
            />
          </div>
        </div>
        <Select id="demand-sector" label="Setor" value={sector} onChange={(e) => setSector(e.target.value as Sector | "")}>
          <option value="">Todos os setores</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select id="demand-priority" label="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
          <option value="">Todas</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        </FilterPanel>
      </Card>

      {loading && <LoadingState label="Carregando demandas…" rows={4} />}
      {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          icon={Factory}
          title="Nenhuma demanda cadastrada"
          description="As demandas de produção aparecem aqui assim que forem registradas."
          action={
            <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
              Cadastrar demanda
            </Link>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">
            {total} demanda(s) exibida(s) em {FLOW_STATUSES.length} etapas
            {cancelledCount > 0 && (
              <>
                {" "}·{" "}
                <Link to="/solicitacoes" className="font-medium text-navy-700 hover:underline">
                  {cancelledCount} cancelada(s) — ver em Solicitações
                </Link>
              </>
            )}
          </p>
          {total === 0 && cancelledCount === 0 && (
            <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Nenhuma demanda corresponde aos filtros aplicados.</p>
          )}
          <div className="grid gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-6">
            {columns.map(({ status, items }) => (
              <section key={status} aria-labelledby={`col-${status}`} className={cn("flex min-h-[12rem] min-w-0 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60 p-3", COLUMN_ACCENT[status])}>
                <header className="mb-3 flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <h2 id={`col-${status}`} className="text-sm font-semibold text-slate-800">
                      {status}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{STATUS_META[status].description}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">{items.length}</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2.5">
                  {items.length === 0 && <li className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Nenhuma demanda</li>}
                  {items.map((a) => (
                    <li key={a.request.id}>
                      <DemandCard analysis={a} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DemandCard({ analysis: a }: { analysis: RequestAnalysis }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-navy-300">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/solicitacoes/${a.request.id}`} className="text-sm font-semibold text-navy-800 hover:underline">
          {a.request.code}
        </Link>
        <PriorityBadge priority={a.request.priority} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-slate-800">{a.request.description}</p>
      <p className="mt-1.5 text-xs text-slate-500">
        {a.request.sector} · {a.request.responsible}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <DeadlineBadge state={a.deadline.state} days={a.deadline.days} />
        <span className="text-[11px] text-slate-500">{formatShortDate(a.request.dueDate)}</span>
      </div>
      {a.request.status !== "Pendente" && (
        <div className="mt-2.5">
          <MiniProgress value={a.progress} />
        </div>
      )}
    </article>
  );
}
