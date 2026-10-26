import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Boxes, CircleCheck, PackageX, Plus, Search, TrendingDown, TriangleAlert, Undo2 } from "lucide-react";
import { MovementTypeBadge, StockStatusBadge } from "@/components/common/DomainBadges";
import { FilterPanel } from "@/components/common/FilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge } from "@/components/common/Widgets";
import { MaterialFormModal, ReverseModal } from "@/components/stock/StockModals";
import { Button, Card, EmptyState, ErrorState, LoadingState, buttonClasses } from "@/components/ui";
import { Select } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@/hooks/useQuery";
import { STOCK_STATUS_META } from "@/lib/businessRules";
import { cn, formatDateTime, formatNumber, normalizeText } from "@/lib/utils";
import { listMaterials, listMovements, type MaterialView } from "@/services/stockService";
import type { StockMovement, StockStatus } from "@/types";

const STOCK_STATUSES: StockStatus[] = ["Normal", "Baixo", "Insuficiente", "Indisponível"];

const SUMMARY_ICONS: Record<StockStatus, typeof Boxes> = {
  Normal: CircleCheck,
  Baixo: TrendingDown,
  Insuficiente: TriangleAlert,
  Indisponível: PackageX,
};

type SortKey = "gravidade" | "nome" | "disponivel" | "codigo";
type Tab = "itens" | "movimentacoes";

export function StockPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const { data, loading, error, refetch } = useQuery(listMaterials);
  const movementsQuery = useQuery(() => listMovements());
  const [tab, setTab] = useState<Tab>("itens");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [showInactive, setShowInactive] = useState(true);
  const [sort, setSort] = useState<SortKey>("gravidade");
  const [formOpen, setFormOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<StockMovement | null>(null);

  const categories = useMemo(() => [...new Set((data ?? []).map((m) => m.category))].sort(), [data]);

  const counts = useMemo(() => {
    const base: Record<StockStatus, number> = { Normal: 0, Baixo: 0, Insuficiente: 0, Indisponível: 0 };
    (data ?? []).filter((m) => m.active).forEach((m) => (base[m.status] += 1));
    return base;
  }, [data]);

  const items = useMemo(() => {
    const term = normalizeText(search);
    const filtered = (data ?? []).filter((m) => {
      if (!showInactive && !m.active) return false;
      if (term && !normalizeText(`${m.code} ${m.name} ${m.location} ${m.description}`).includes(term)) return false;
      if (category && m.category !== category) return false;
      if (status && m.status !== status) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      switch (sort) {
        case "nome":
          return a.name.localeCompare(b.name, "pt-BR");
        case "disponivel":
          return a.available - b.available;
        case "codigo":
          return a.code.localeCompare(b.code);
        default:
          return STOCK_STATUS_META[b.status].severity - STOCK_STATUS_META[a.status].severity || a.name.localeCompare(b.name, "pt-BR");
      }
    });
  }, [data, search, category, status, showInactive, sort]);

  const movements = useMemo(() => {
    const term = normalizeText(search);
    return (movementsQuery.data ?? []).filter((m) => {
      if (!term) return true;
      const mat = (data ?? []).find((x) => x.id === m.materialId);
      return normalizeText(`${mat?.code ?? ""} ${mat?.name ?? ""} ${m.reason}`).includes(term);
    });
  }, [movementsQuery.data, data, search]);

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setStatus("");
    setSort("gravidade");
  };

  const materialName = (id: string) => {
    const mat = (data ?? []).find((x) => x.id === id);
    return mat ? `${mat.code} · ${mat.name}` : id;
  };

  const reversedIds = useMemo(
    () => new Set((movementsQuery.data ?? []).filter((m) => m.reversalOf).map((m) => m.reversalOf as string)),
    [movementsQuery.data],
  );

  return (
    <>
      <div className="mb-3">
        <DemoBadge />
      </div>
      <PageHeader
        title="Controle de estoque"
        description="Cadastre itens, registre entradas, saídas e ajustes, estorne movimentações e consulte o histórico. Toda alteração de saldo é rastreável."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Estoque" }]}
        actions={
          can("material.create") ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar item
            </Button>
          ) : (
            <Button disabled title="Seu perfil não tem permissão para cadastrar itens.">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar item
            </Button>
          )
        }
      />

      {/* Botões com estado (aria-pressed): funcionam com Tab, Enter e Espaço. */}
      <div role="group" aria-label="Visões do estoque" className="mb-4 flex gap-2">
        {(["itens", "movimentacoes"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-navy-800 text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
            )}
          >
            {t === "itens" ? "Itens" : "Movimentações"}
          </button>
        ))}
      </div>

      {tab === "itens" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" role="group" aria-label="Filtrar por situação de estoque">
            {STOCK_STATUSES.map((s) => {
              const Icon = SUMMARY_ICONS[s];
              const pressed = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setStatus(pressed ? "" : s)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700",
                    pressed ? "border-navy-700 ring-2 ring-navy-200" : "border-slate-200/80",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{s}</span>
                    <span className="block text-2xl font-semibold tabular-nums text-navy-900">{counts[s]}</span>
                  </span>
                  <Icon className={cn("h-6 w-6 shrink-0", STOCK_STATUS_META[s].tone === "danger" ? "text-rose-600" : STOCK_STATUS_META[s].tone === "warning" ? "text-amber-600" : "text-emerald-600")} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <Card className="mb-4 overflow-hidden">
            <FilterPanel
              activeCount={(search ? 1 : 0) + (category ? 1 : 0) + (status ? 1 : 0) + (!showInactive ? 1 : 0)}
              contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr]"
            >
              <div>
                <label htmlFor="stock-search" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Pesquisar material
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="stock-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Código, nome ou localização"
                    className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
                  />
                </div>
              </div>
              <Select id="stock-category" label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select id="stock-status" label="Situação" value={status} onChange={(e) => setStatus(e.target.value as StockStatus | "")}>
                <option value="">Todas as situações</option>
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Select id="stock-sort" label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="gravidade">Situação (mais crítica)</option>
                <option value="nome">Nome</option>
                <option value="codigo">Código</option>
                <option value="disponivel">Disponível (menor)</option>
              </Select>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 md:col-span-2 xl:col-span-4">
                <p aria-live="polite">{data ? `${items.length} de ${data.length} material(is)` : "Carregando…"}</p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                    Exibir inativos
                  </label>
                  {(search || category || status) && (
                    <button type="button" onClick={clearFilters} className="rounded-md px-2 py-1 font-medium text-navy-700 hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>
            </FilterPanel>
          </Card>

          {loading && <LoadingState label="Carregando estoque…" rows={5} />}
          {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
          {!loading && !error && data && data.length === 0 && (
            <EmptyState icon={Boxes} title="Nenhum material cadastrado" description="Cadastre o primeiro item do almoxarifado." action={can("material.create") ? <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar item</Button> : undefined} />
          )}
          {!loading && !error && data && data.length > 0 && items.length === 0 && (
            <EmptyState icon={Search} title="Nenhum material encontrado" description="Tente outros termos ou remova os filtros aplicados." action={<button type="button" onClick={clearFilters} className={buttonClasses("outline")}>Limpar filtros</button>} />
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Materiais em estoque</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Código</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Material</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Categoria</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Disponível</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Reservado</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Saldo livre</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Mínimo</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Localização</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((m) => (
                      <StockRow key={m.id} material={m} />
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 lg:hidden">
                {items.map((m) => (
                  <li key={m.id} className={cn("rounded-lg border bg-white p-4", m.status === "Insuficiente" || m.status === "Indisponível" ? "border-rose-200" : "border-slate-200", !m.active && "opacity-75")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/estoque/${m.id}`} className="font-semibold text-navy-800 hover:underline">
                          {m.code}
                        </Link>
                        {!m.active && <span className="ml-2 rounded-sm bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">Inativo</span>}
                        <p className="text-sm text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.category} · {m.location}</p>
                      </div>
                      <StockStatusBadge status={m.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <div><dt>Disponível</dt><dd className="font-semibold text-slate-900">{formatNumber(m.available)} {m.unit}</dd></div>
                      <div><dt>Reservado</dt><dd className="font-semibold text-slate-900">{formatNumber(m.reserved)} {m.unit}</dd></div>
                      <div><dt>Saldo livre</dt><dd className="font-semibold text-slate-900">{formatNumber(m.freeBalance)} {m.unit}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === "movimentacoes" && (
        <Card>
          {movementsQuery.loading ? (
            <div className="p-5"><LoadingState label="Carregando movimentações…" rows={3} /></div>
          ) : movementsQuery.error ? (
            <div className="p-5"><ErrorState message={movementsQuery.error.message} onRetry={movementsQuery.refetch} /></div>
          ) : movements.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação encontrada" description="Entradas, saídas, ajustes e estornos aparecem aqui." />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Histórico de movimentações de estoque</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Material</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Qtd.</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Saldo após</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Motivo / ator</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600"><time dateTime={m.timestamp}>{formatDateTime(m.timestamp)}</time></td>
                        <td className="px-4 py-3"><Link to={`/estoque/${m.materialId}`} className="font-medium text-navy-800 hover:underline">{materialName(m.materialId)}</Link></td>
                        <td className="px-4 py-3"><MovementTypeBadge type={m.type} /></td>
                        <td className="px-4 py-3 text-right tabular-nums">{m.type === "saida" ? "−" : "+"}{formatNumber(m.quantity)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(m.balanceAfter)}</td>
                        <td className="px-4 py-3"><p className="max-w-xs truncate" title={m.reason}>{m.reason}</p><p className="text-xs text-slate-500">{m.actor}</p></td>
                        <td className="px-4 py-3">
                          {m.type !== "estorno" && !reversedIds.has(m.id) && can("stock.reverse") ? (
                            <button type="button" onClick={() => setReverseTarget(m)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50">
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Estornar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">{m.type === "estorno" ? `Estorno de ${m.reversalOf?.slice(0, 12)}…` : reversedIds.has(m.id) ? "Estornado" : "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 p-4 lg:hidden">
                {movements.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <MovementTypeBadge type={m.type} />
                      <time dateTime={m.timestamp} className="text-xs text-slate-500">{formatDateTime(m.timestamp)}</time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{materialName(m.materialId)}</p>
                    <p className="text-sm tabular-nums text-slate-700">{m.type === "saida" ? "−" : "+"}{formatNumber(m.quantity)} → saldo {formatNumber(m.balanceAfter)}</p>
                    <p className="mt-1 text-xs text-slate-500">{m.reason} · {m.actor}</p>
                    {m.type !== "estorno" && !reversedIds.has(m.id) && can("stock.reverse") && (
                      <button type="button" onClick={() => setReverseTarget(m)} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50">
                        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Estornar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      <MaterialFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(material) => {
          toast({ title: "Item cadastrado", description: `${material.code} · ${material.name}.`, variant: "success" });
        }}
      />
      <ReverseModal
        open={reverseTarget !== null}
        movement={reverseTarget}
        material={(data ?? []).find((m) => m.id === reverseTarget?.materialId) ?? null}
        onClose={() => setReverseTarget(null)}
        onSaved={() => {
          toast({ title: "Estorno registrado", description: "A compensação foi registrada sem apagar o original.", variant: "success" });
          movementsQuery.refetch();
        }}
      />
    </>
  );
}

function StockRow({ material: m }: { material: MaterialView }) {
  const critical = m.status === "Insuficiente" || m.status === "Indisponível";
  return (
    <tr className={cn("hover:bg-slate-50/70", critical && "bg-rose-50/40", !m.active && "opacity-70")}>
      <td className="whitespace-nowrap px-4 py-3">
        <Link to={`/estoque/${m.id}`} className="font-semibold text-navy-800 hover:underline">
          {m.code}
        </Link>
        {!m.active && <span className="ml-2 rounded-sm bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">Inativo</span>}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{m.name}</p>
        <p className="line-clamp-1 text-xs text-slate-500">{m.description}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{m.category}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(m.available)} {m.unit}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(m.reserved)} {m.unit}</td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatNumber(m.freeBalance)} {m.unit}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(m.minimumStock)} {m.unit}</td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{m.location}</td>
      <td className="px-4 py-3">
        <StockStatusBadge status={m.status} />
      </td>
    </tr>
  );
}
