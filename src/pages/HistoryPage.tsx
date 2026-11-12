import { useMemo, useState } from "react";
import { Download, History, Search, ShieldAlert } from "lucide-react";
import { HistoryKindBadge } from "@/components/common/DomainBadges";
import { FilterPanel } from "@/components/common/FilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/Widgets";
import { Button, Card, EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { downloadCsv, formatDateTime, normalizeText } from "@/lib/utils";
import { listHistory } from "@/services/activityService";
import type { HistoryEntry, HistoryKind } from "@/types";

const PAGE_SIZE = 10;

const KIND_OPTIONS: { value: HistoryKind | ""; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "criacao", label: "Criação" },
  { value: "edicao", label: "Edição" },
  { value: "status", label: "Mudança de status" },
  { value: "separacao", label: "Separação" },
  { value: "estoque", label: "Estoque" },
  { value: "cancelamento", label: "Cancelamento" },
  { value: "movimentacao", label: "Movimentação" },
  { value: "cadastro", label: "Cadastro" },
  { value: "sistema", label: "Sistema" },
];

const PERIOD_DAYS: Record<string, number | null> = { todos: null, "7": 7, "30": 30, "90": 90 };

export function HistoryPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<HistoryKind | "">("");
  const [period, setPeriod] = useState("todos");
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(() => listHistory());

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    const days = PERIOD_DAYS[period];
    const since = days === null ? 0 : Date.now() - days * 86_400_000;
    return (data ?? []).filter((h) => {
      if (kind && h.kind !== kind) return false;
      if (since && new Date(h.timestamp).getTime() < since) return false;
      if (term && !normalizeText(`${h.requestCode ?? ""} ${h.action} ${h.actor} ${h.details ?? ""} ${h.from ?? ""} ${h.to ?? ""}`).includes(term)) return false;
      return true;
    });
  }, [data, search, kind, period]);

  const stats = useMemo(() => {
    const statusChanges = filtered.filter((h) => h.kind === "status").length;
    const separations = filtered.filter((h) => h.kind === "separacao").length;
    const shortages = filtered.filter((h) => h.kind === "estoque").length;
    const actors = new Set(filtered.map((h) => h.actor)).size;
    return { statusChanges, separations, shortages, actors };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const update = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Data e hora", "Solicitação", "Tipo", "Ação", "De", "Para", "Responsável", "Detalhes"],
      ...filtered.map((h) => [formatDateTime(h.timestamp), h.requestCode ?? "", h.kind, h.action, h.from ?? "", h.to ?? "", h.actor, h.details ?? ""]),
    ];
    downloadCsv(`historico-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Histórico exportado", description: `${filtered.length} registro(s).`, variant: "success" });
  };

  return (
    <>
      <PageHeader
        title="Histórico e rastreabilidade"
        description="Linha do tempo das solicitações: criação, mudanças de status, separações e ocorrências de estoque."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Histórico" }]}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />

      <div role="note" className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Registros de demonstração.</strong> Os responsáveis e horários são fictícios e não constituem trilha de auditoria oficial.
          A rastreabilidade real será implementada com a persistência no backend.
        </p>
      </div>

      <section aria-label="Resumo do histórico" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Mudanças de status" value={stats.statusChanges} icon={History} />
        <KpiCard label="Registros de separação" value={stats.separations} icon={History} tone="accent" />
        <KpiCard label="Ocorrências de estoque" value={stats.shortages} icon={History} tone="warning" />
        <KpiCard label="Responsáveis envolvidos" value={stats.actors} icon={History} tone="info" />
      </section>

      <Card className="mb-4 overflow-hidden">
        <FilterPanel
          activeCount={(search ? 1 : 0) + (kind ? 1 : 0) + (period !== "todos" ? 1 : 0)}
          contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_1fr_1fr]"
        >
        <div>
          <label htmlFor="hist-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Pesquisar no histórico
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="hist-search"
              type="search"
              value={search}
              onChange={(e) => update(() => setSearch(e.target.value))}
              placeholder="Código, responsável, ação ou detalhe"
              className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
        <Select id="hist-kind" label="Tipo de registro" value={kind} onChange={(e) => update(() => setKind(e.target.value as HistoryKind | ""))}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select id="hist-period" label="Período" value={period} onChange={(e) => update(() => setPeriod(e.target.value))}>
          <option value="todos">Todo o período</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </Select>
        </FilterPanel>
      </Card>

      {loading && <LoadingState label="Carregando histórico…" rows={4} />}
      {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
      {!loading && !error && data && filtered.length === 0 && (
        <EmptyState
          icon={History}
          title="Nenhum registro encontrado"
          description="Ajuste os filtros ou a pesquisa para ver outros registros."
          action={
            <Button variant="outline" onClick={() => update(() => { setSearch(""); setKind(""); setPeriod("todos"); })}>
              Limpar filtros
            </Button>
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registros de histórico</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Data e hora</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Solicitação</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Ação</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Mudança</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((h) => (
                  <HistoryRow key={h.id} entry={h} />
                ))}
              </tbody>
            </table>
          </div>

          <ol className="space-y-3 lg:hidden">
            {pageItems.map((h) => (
              <li key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <time dateTime={h.timestamp} className="text-xs text-slate-500">{formatDateTime(h.timestamp)}</time>
                  <HistoryKindBadge kind={h.kind} />
                </div>
                <p className="mt-2 font-medium text-slate-900">{h.action}</p>
                {h.requestCode && <p className="text-sm text-navy-800">{h.requestCode}</p>}
                {h.from && h.to && <p className="mt-1 text-xs text-slate-600">{h.from} → {h.to}</p>}
                {h.details && <p className="mt-1 text-sm text-slate-600">{h.details}</p>}
                <p className="mt-2 text-xs text-slate-500">Responsável: {h.actor}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
            />
          </div>
        </>
      )}
    </>
  );
}

function HistoryRow({ entry: h }: { entry: HistoryEntry }) {
  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        <time dateTime={h.timestamp}>{formatDateTime(h.timestamp)}</time>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-medium text-navy-800">{h.requestCode ?? "—"}</td>
      <td className="px-4 py-3"><HistoryKindBadge kind={h.kind} /></td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{h.action}</p>
        {h.details && <p className="mt-0.5 text-xs text-slate-600">{h.details}</p>}
      </td>
      <td className="px-4 py-3 text-slate-700">{h.from && h.to ? `${h.from} → ${h.to}` : "—"}</td>
      <td className="px-4 py-3 text-slate-700">{h.actor}</td>
    </tr>
  );
}
