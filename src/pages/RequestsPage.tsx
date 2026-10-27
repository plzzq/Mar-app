import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Download, Factory, Plus, Search, SearchX } from "lucide-react";
import { DeadlineBadge, PriorityBadge } from "@/components/common/DomainBadges";
import { FilterPanel } from "@/components/common/FilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { MiniProgress, RequestCards, RequestTable } from "@/components/requests/RequestList";
import { Button, Card, EmptyState, ErrorState, LoadingState, Pagination, buttonClasses } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@/hooks/useQuery";
import { PRIORITY_META, STATUS_META } from "@/lib/businessRules";
import type { RequestAnalysis } from "@/lib/businessRules";
import { cn, downloadCsv, formatDateOnly, formatDateTime, formatShortDate, normalizeText } from "@/lib/utils";
import { listRequestAnalyses } from "@/services/requestsService";
import { PRIORITIES, REQUEST_STATUSES, SECTORS, type Priority, type RequestStatus, type Sector } from "@/types";

/* ─────────────────────────── Lista ─────────────────────────── */

const PAGE_SIZE = 8;
type Period  = "todos" | "7" | "30" | "90";
type SortKey = "prazo" | "prioridade" | "recentes" | "antigas";

interface Filters {
  search: string;
  status: RequestStatus | "";
  priority: Priority | "";
  sector: Sector | "";
  period: Period;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = {
  search: "", status: "", priority: "", sector: "", period: "todos", sort: "prazo",
};

function applyFilters(items: RequestAnalysis[], f: Filters): RequestAnalysis[] {
  const term  = normalizeText(f.search);
  const since = f.period === "todos" ? 0 : Date.now() - Number(f.period) * 86_400_000;
  const filtered = items.filter(({ request: r }) => {
    if (term  && !normalizeText(`${r.code} ${r.description}`).includes(term)) return false;
    if (f.status   && r.status   !== f.status)   return false;
    if (f.priority && r.priority !== f.priority) return false;
    if (f.sector   && r.sector   !== f.sector)   return false;
    if (since && new Date(r.createdAt).getTime() < since) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    switch (f.sort) {
      case "prioridade":
        return PRIORITY_META[b.request.priority].weight - PRIORITY_META[a.request.priority].weight
          || a.request.dueDate.localeCompare(b.request.dueDate);
      case "recentes": return b.request.createdAt.localeCompare(a.request.createdAt);
      case "antigas":  return a.request.createdAt.localeCompare(b.request.createdAt);
      default:         return a.request.dueDate.localeCompare(b.request.dueDate);
    }
  });
}

/* ─────────────────────────── Kanban ────────────────────────── */

const FLOW_STATUSES: RequestStatus[] = REQUEST_STATUSES.filter((s) => s !== "Cancelada");

const COLUMN_ACCENT: Record<RequestStatus, string> = {
  Pendente:                     "border-t-slate-400",
  "Em análise":                 "border-t-sky-500",
  "Aguardando materiais":       "border-t-amber-500",
  "Em separação":               "border-t-blue-700",
  "Pronta para disponibilização": "border-t-teal-600",
  Concluída:                    "border-t-emerald-600",
  Cancelada:                    "border-t-stone-500",
};

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

/* ─────────────────────────── Página principal ──────────────── */

type Tab = "lista" | "kanban";

export function RequestsPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("lista");

  /* ── filtros lista ── */
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get("q") ?? "",
    sort: searchParams.get("ordem") === "prazo" ? "prazo" : DEFAULT_FILTERS.sort,
  }));
  const [page, setPage] = useState(1);

  /* ── filtros kanban ── */
  const [kSearch,   setKSearch]   = useState("");
  const [kSector,   setKSector]   = useState<Sector | "">("");
  const [kPriority, setKPriority] = useState<Priority | "">("");

  const { data, loading, error, refetch } = useQuery(listRequestAnalyses);

  /* ── lista ── */
  const patch = (changes: Partial<Filters>) => { setFilters((c) => ({ ...c, ...changes })); setPage(1); };
  const filtered    = useMemo(() => (data ? applyFilters(data, filters) : []), [data, filters]);
  const pageCount   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters  = filters.search !== "" || filters.status !== "" || filters.priority !== "" || filters.sector !== "" || filters.period !== "todos";

  /* ── kanban ── */
  const columns = useMemo(() => {
    const term = normalizeText(kSearch);
    const kFiltered = (data ?? []).filter(({ request: r }) => {
      if (term && !normalizeText(`${r.code} ${r.description} ${r.responsible}`).includes(term)) return false;
      if (kSector   && r.sector   !== kSector)   return false;
      if (kPriority && r.priority !== kPriority) return false;
      return true;
    });
    return FLOW_STATUSES.map((status) => ({
      status,
      items: kFiltered.filter((a) => a.request.status === status)
        .sort((a, b) => a.request.dueDate.localeCompare(b.request.dueDate)),
    }));
  }, [data, kSearch, kSector, kPriority]);

  const kTotal = columns.reduce((s, c) => s + c.items.length, 0);
  const cancelledCount = useMemo(() => (data ?? []).filter(({ request: r }) => {
    if (r.status !== "Cancelada") return false;
    const term = normalizeText(kSearch);
    if (term && !normalizeText(`${r.code} ${r.description} ${r.responsible}`).includes(term)) return false;
    if (kSector   && r.sector   !== kSector)   return false;
    if (kPriority && r.priority !== kPriority) return false;
    return true;
  }).length, [data, kSearch, kSector, kPriority]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Código", "Descrição", "Setor", "Responsável", "Prioridade", "Status", "Criação", "Prazo", "Separação (%)"],
      ...filtered.map(({ request: r, progress }) => [
        r.code, r.description, r.sector, r.responsible, r.priority, r.status,
        formatDateTime(r.createdAt), formatDateOnly(r.dueDate), progress,
      ]),
    ];
    downloadCsv(`solicitacoes-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Exportação concluída", description: `${filtered.length} solicitação(ões) exportada(s).`, variant: "success" });
  };

  return (
    <>
      <PageHeader
        title="Solicitações de materiais"
        description="Cadastre, acompanhe e filtre as solicitações de materiais enviadas pelos setores."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Solicitações" }]}
        actions={
          <>
            {tab === "lista" && (
              <Button variant="outline" onClick={exportCsv} disabled={!data || filtered.length === 0}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar CSV
              </Button>
            )}
            {can("request.create") && (
              <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova solicitação
              </Link>
            )}
          </>
        }
      />

      {/* ── Abas internas ── */}
      <div role="tablist" aria-label="Visualização das solicitações" className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "lista"}
          onClick={() => setTab("lista")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700",
            tab === "lista"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "kanban"}
          onClick={() => setTab("kanban")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700",
            tab === "kanban"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <Factory className="h-4 w-4" aria-hidden="true" />
          Demandas (Kanban)
        </button>
      </div>

      {/* ══════════════ ABA LISTA ══════════════ */}
      {tab === "lista" && (
        <>
          <Card className="mb-4 overflow-hidden">
            <FilterPanel
              activeCount={
                (filters.search ? 1 : 0) + (filters.status ? 1 : 0) +
                (filters.priority ? 1 : 0) + (filters.sector ? 1 : 0) +
                (filters.period !== "todos" ? 1 : 0)
              }
            >
              <form role="search" aria-label="Filtros de solicitações" onSubmit={(e) => e.preventDefault()} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="md:col-span-2 xl:col-span-2">
                  <label htmlFor="req-search" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Pesquisar por código ou descrição
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="req-search"
                      type="search"
                      value={filters.search}
                      onChange={(e) => patch({ search: e.target.value })}
                      placeholder="Ex.: SOL-2026-003 ou painel"
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
                <Select id="req-status" label="Status" value={filters.status} onChange={(e) => patch({ status: e.target.value as RequestStatus | "" })}>
                  <option value="">Todos os status</option>
                  {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select id="req-priority" label="Prioridade" value={filters.priority} onChange={(e) => patch({ priority: e.target.value as Priority | "" })}>
                  <option value="">Todas</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select id="req-sector" label="Setor" value={filters.sector} onChange={(e) => patch({ sector: e.target.value as Sector | "" })}>
                  <option value="">Todos os setores</option>
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select id="req-period" label="Período de criação" value={filters.period} onChange={(e) => patch({ period: e.target.value as Period })}>
                  <option value="todos">Todo o período</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                </Select>
                <Select id="req-sort" label="Ordenar por" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortKey })}>
                  <option value="prazo">Prazo (mais próximo)</option>
                  <option value="prioridade">Prioridade (maior)</option>
                  <option value="recentes">Data de criação (recente)</option>
                  <option value="antigas">Data de criação (antiga)</option>
                </Select>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <p aria-live="polite">
                  {data ? `${filtered.length} de ${data.length} solicitação(ões)` : "Carregando…"}
                </p>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            </FilterPanel>
          </Card>

          {loading && <LoadingState label="Carregando solicitações…" rows={4} />}
          {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
          {!loading && !error && data && data.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma solicitação cadastrada"
              description="Cadastre a primeira solicitação de materiais para iniciar o acompanhamento."
              action={can("request.create") ? (
                <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Cadastrar solicitação
                </Link>
              ) : undefined}
            />
          )}
          {!loading && !error && data && data.length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="Nenhum resultado para os filtros aplicados"
              description="Ajuste a pesquisa ou remova alguns filtros para ver mais solicitações."
              action={<Button variant="outline" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>Limpar filtros</Button>}
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-0">
              <RequestTable items={pageItems} />
              <RequestCards items={pageItems} />
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  totalItems={filtered.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════ ABA KANBAN ══════════════ */}
      {tab === "kanban" && (
        <>
          <Card className="mb-4 overflow-hidden">
            <FilterPanel
              activeCount={(kSearch ? 1 : 0) + (kSector ? 1 : 0) + (kPriority ? 1 : 0)}
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
                    value={kSearch}
                    onChange={(e) => setKSearch(e.target.value)}
                    placeholder="Código, descrição ou responsável"
                    className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
                  />
                </div>
              </div>
              <Select id="demand-sector" label="Setor" value={kSector} onChange={(e) => setKSector(e.target.value as Sector | "")}>
                <option value="">Todos os setores</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select id="demand-priority" label="Prioridade" value={kPriority} onChange={(e) => setKPriority(e.target.value as Priority | "")}>
                <option value="">Todas</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
              action={can("request.create") ? (
                <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
                  Cadastrar demanda
                </Link>
              ) : undefined}
            />
          )}
          {!loading && !error && data && data.length > 0 && (
            <>
              <p className="mb-3 text-sm text-slate-600" aria-live="polite">
                {kTotal} demanda(s) exibida(s) em {FLOW_STATUSES.length} etapas
                {cancelledCount > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => { setTab("lista"); patch({ status: "Cancelada" }); }}
                      className="font-medium text-navy-700 hover:underline"
                    >
                      {cancelledCount} cancelada(s) — ver na Lista
                    </button>
                  </>
                )}
              </p>
              {kTotal === 0 && cancelledCount === 0 && (
                <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Nenhuma demanda corresponde aos filtros aplicados.
                </p>
              )}
              <div className="grid gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-6">
                {columns.map(({ status, items }) => (
                  <section
                    key={status}
                    aria-labelledby={`col-${status}`}
                    className={cn(
                      "flex min-h-[12rem] min-w-0 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60 p-3",
                      COLUMN_ACCENT[status],
                    )}
                  >
                    <header className="mb-3 flex items-start justify-between gap-2 px-1">
                      <div className="min-w-0">
                        <h2 id={`col-${status}`} className="text-sm font-semibold text-slate-800">{status}</h2>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                          {STATUS_META[status].description}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">
                        {items.length}
                      </span>
                    </header>
                    <ul className="flex flex-1 flex-col gap-2.5">
                      {items.length === 0 && (
                        <li className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                          Nenhuma demanda
                        </li>
                      )}
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
      )}
    </>
  );
}
