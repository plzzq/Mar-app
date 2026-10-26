import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Plus, Search, SearchX, ClipboardList } from "lucide-react";
import { FilterPanel } from "@/components/common/FilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { RequestCards, RequestTable } from "@/components/requests/RequestList";
import { Button, Card, EmptyState, ErrorState, LoadingState, Pagination, buttonClasses } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useQuery } from "@/hooks/useQuery";
import { useToast } from "@/contexts/ToastContext";
import { PRIORITY_META } from "@/lib/businessRules";
import type { RequestAnalysis } from "@/lib/businessRules";
import { downloadCsv, formatDateOnly, formatDateTime, normalizeText } from "@/lib/utils";
import { PRIORITIES, REQUEST_STATUSES, SECTORS, type Priority, type RequestStatus, type Sector } from "@/types";
import { listRequestAnalyses } from "@/services/requestsService";

const PAGE_SIZE = 8;

type Period = "todos" | "7" | "30" | "90";
type SortKey = "prazo" | "prioridade" | "recentes" | "antigas";

interface Filters {
  search: string;
  status: RequestStatus | "";
  priority: Priority | "";
  sector: Sector | "";
  period: Period;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = { search: "", status: "", priority: "", sector: "", period: "todos", sort: "prazo" };

function applyFilters(items: RequestAnalysis[], f: Filters): RequestAnalysis[] {
  const term = normalizeText(f.search);
  const since = f.period === "todos" ? 0 : Date.now() - Number(f.period) * 86_400_000;

  const filtered = items.filter(({ request: r }) => {
    if (term && !normalizeText(`${r.code} ${r.description}`).includes(term)) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.priority && r.priority !== f.priority) return false;
    if (f.sector && r.sector !== f.sector) return false;
    if (since && new Date(r.createdAt).getTime() < since) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    switch (f.sort) {
      case "prioridade":
        return PRIORITY_META[b.request.priority].weight - PRIORITY_META[a.request.priority].weight || a.request.dueDate.localeCompare(b.request.dueDate);
      case "recentes":
        return b.request.createdAt.localeCompare(a.request.createdAt);
      case "antigas":
        return a.request.createdAt.localeCompare(b.request.createdAt);
      default:
        return a.request.dueDate.localeCompare(b.request.dueDate);
    }
  });
}

export function RequestsPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get("q") ?? "",
    sort: searchParams.get("ordem") === "prazo" ? "prazo" : DEFAULT_FILTERS.sort,
  }));
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(listRequestAnalyses);

  const patch = (changes: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...changes }));
    setPage(1);
  };

  const filtered = useMemo(() => (data ? applyFilters(data, filters) : []), [data, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters =
    filters.search !== "" || filters.status !== "" || filters.priority !== "" || filters.sector !== "" || filters.period !== "todos";

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Código", "Descrição", "Setor", "Responsável", "Prioridade", "Status", "Criação", "Prazo", "Separação (%)"],
      ...filtered.map(({ request: r, progress }) => [
        r.code,
        r.description,
        r.sector,
        r.responsible,
        r.priority,
        r.status,
        formatDateTime(r.createdAt),
        formatDateOnly(r.dueDate),
        progress,
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
            <Button variant="outline" onClick={exportCsv} disabled={!data || filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
            <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova solicitação
            </Link>
          </>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <FilterPanel
          activeCount={
            (filters.search ? 1 : 0) +
            (filters.status ? 1 : 0) +
            (filters.priority ? 1 : 0) +
            (filters.sector ? 1 : 0) +
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
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select id="req-priority" label="Prioridade" value={filters.priority} onChange={(e) => patch({ priority: e.target.value as Priority | "" })}>
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <Select id="req-sector" label="Setor" value={filters.sector} onChange={(e) => patch({ sector: e.target.value as Sector | "" })}>
            <option value="">Todos os setores</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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
          action={
            <Link to="/solicitacoes/nova" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Cadastrar solicitação
            </Link>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="Nenhum resultado para os filtros aplicados"
          description="Ajuste a pesquisa ou remova alguns filtros para ver mais solicitações."
          action={
            <Button variant="outline" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>
              Limpar filtros
            </Button>
          }
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
  );
}
