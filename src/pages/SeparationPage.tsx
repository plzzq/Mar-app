import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CircleCheck, Eye, EyeOff, PackageCheck, PackageOpen, Play, Truck } from "lucide-react";
import { DeadlineBadge, PriorityBadge, RequestStatusBadge } from "@/components/common/DomainBadges";
import { PageHeader } from "@/components/common/PageHeader";
import { ShortageAlert, type ShortageItem } from "@/components/common/Widgets";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Progress } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import {
  compareForSeparation,
  getSeparationBlockers,
  isSeparationComplete,
  type ItemAnalysis,
  type RequestAnalysis,
} from "@/lib/businessRules";
import { getErrorMessage } from "@/lib/errors";
import { cn, formatDateOnly, formatNumber } from "@/lib/utils";
import {
  changeRequestStatus,
  listRequestAnalyses,
  registerSeparation,
  reportShortage,
  separateAllPending,
} from "@/services/requestsService";

type Tab = "todas" | "aguardando" | "separacao" | "prontas";

const TABS: { id: Tab; label: string; statuses: RequestAnalysis["request"]["status"][] }[] = [
  { id: "todas", label: "Todas", statuses: ["Em análise", "Aguardando materiais", "Em separação", "Pronta para disponibilização"] },
  { id: "aguardando", label: "Aguardando", statuses: ["Em análise", "Aguardando materiais"] },
  { id: "separacao", label: "Em separação", statuses: ["Em separação"] },
  { id: "prontas", label: "Prontas", statuses: ["Pronta para disponibilização"] },
];

type RunAction = (action: () => Promise<unknown>, title: string, description: string) => Promise<void>;

export function SeparationPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("todas");
  const [busy, setBusy] = useState(false);
  const { data, loading, error, refetch } = useQuery(listRequestAnalyses);

  const queue = useMemo(() => {
    const statuses = TABS[0].statuses;
    return (data ?? []).filter((a) => statuses.includes(a.request.status)).sort(compareForSeparation);
  }, [data]);

  const visible = useMemo(() => {
    const current = TABS.find((t) => t.id === tab) ?? TABS[0];
    return queue.filter((a) => current.statuses.includes(a.request.status));
  }, [queue, tab]);

  const summary = useMemo(() => {
    const requested = queue.reduce((s, a) => s + a.requested, 0);
    const separated = queue.reduce((s, a) => s + a.separated, 0);
    return {
      pendingUnits: queue.reduce((s, a) => s + a.pending, 0),
      inSeparation: queue.filter((a) => a.request.status === "Em separação").length,
      ready: queue.filter((a) => a.request.status === "Pronta para disponibilização").length,
      withShortage: queue.filter((a) => a.shortages.length > 0).length,
      percent: requested === 0 ? 0 : Math.round((separated / requested) * 100),
    };
  }, [queue]);

  const run: RunAction = async (action, title, description) => {
    setBusy(true);
    try {
      await action();
      toast({ title, description, variant: "success" });
    } catch (err) {
      toast({ title: "Ação não permitida", description: getErrorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Separação de materiais"
        description="Fila operacional do almoxarifado, ordenada por prioridade e prazo. Registre a separação item a item e informe faltas de material."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Separação de materiais" }]}
      />

      <section aria-label="Resumo da separação" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryTile label="Unidades a separar" value={formatNumber(summary.pendingUnits)} icon={PackageOpen} />
        <SummaryTile label="Em separação" value={String(summary.inSeparation)} icon={Play} />
        <SummaryTile label="Prontas para disponibilização" value={String(summary.ready)} icon={Truck} />
        <SummaryTile label="Com falta de material" value={String(summary.withShortage)} icon={AlertTriangle} tone={summary.withShortage > 0 ? "danger" : "neutral"} />
        <Card className="col-span-2 flex flex-col justify-center p-4 xl:col-span-1">
          <Progress value={summary.percent} label="Andamento geral" />
        </Card>
      </section>

      <div role="tablist" aria-label="Filtrar fila de separação" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t, index) => {
          const count = queue.filter((a) => a.request.status && t.statuses.includes(a.request.status)).length;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls="separation-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(event) => {
                // Setas ← → e Home/End conforme o padrão de abas acessível.
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const nextIndex =
                  event.key === "ArrowLeft"
                    ? index <= 0
                      ? TABS.length - 1
                      : index - 1
                    : event.key === "ArrowRight"
                      ? index >= TABS.length - 1
                        ? 0
                        : index + 1
                      : event.key === "Home"
                        ? 0
                        : TABS.length - 1;
                document.getElementById(`tab-${TABS[nextIndex].id}`)?.click();
                document.getElementById(`tab-${TABS[nextIndex].id}`)?.focus();
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700",
                selected ? "bg-navy-800 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
              )}
            >
              {t.label} <span className="ml-1 tabular-nums opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      <div id="separation-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="space-y-4">
        {loading && <LoadingState label="Carregando fila de separação…" rows={3} />}
        {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
        {!loading && !error && data && visible.length === 0 && (
          <EmptyState
            icon={PackageCheck}
            title="Nenhuma solicitação nesta etapa"
            description="Quando houver solicitações aguardando separação, elas aparecerão aqui em ordem de prioridade."
            action={
              <Link to="/solicitacoes" className="text-sm font-medium text-navy-700 hover:underline">
                Ver todas as solicitações
              </Link>
            }
          />
        )}
        {!loading &&
          !error &&
          visible.map((analysis) => <SeparationCard key={analysis.request.id} analysis={analysis} run={run} busy={busy} />)}
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: typeof PackageOpen;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", tone === "danger" ? "text-rose-700" : "text-navy-900")}>{value}</p>
      </div>
      <Icon className={cn("h-6 w-6 shrink-0", tone === "danger" ? "text-rose-600" : "text-navy-600")} aria-hidden="true" />
    </div>
  );
}

function SeparationCard({ analysis: a, run, busy }: { analysis: RequestAnalysis; run: RunAction; busy: boolean }) {
  const r = a.request;
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [showPendencies, setShowPendencies] = useState(false);
  const [confirm, setConfirm] = useState<"shortage" | "complete" | "deliver" | null>(null);
  const [quantityError, setQuantityError] = useState<Record<string, string>>({});

  const isSeparating = r.status === "Em separação";
  const canStart = r.status === "Em análise" || r.status === "Aguardando materiais";
  const blockers = canStart ? getSeparationBlockers(a) : [];
  const complete = isSeparationComplete(r);
  const pendingItems = a.items.filter((i) => i.pending > 0);

  const separateItem = (item: ItemAnalysis) => {
    const materialId = item.item.materialId;
    const raw = quantities[materialId] ?? String(item.pending);
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty <= 0 || qty > item.pending) {
      setQuantityError((prev) => ({ ...prev, [materialId]: `Informe de 1 a ${item.pending}.` }));
      return;
    }
    setQuantityError((prev) => ({ ...prev, [materialId]: "" }));
    const unit = item.material?.unit ?? "un";
    void run(
      () => registerSeparation(r.id, materialId, qty),
      "Separação registrada",
      `${formatNumber(qty)} ${unit} de ${item.material?.name ?? materialId} em ${r.code}.`,
    );
  };

  const pendingUnits = a.pending;

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/solicitacoes/${r.id}`} className="font-semibold text-navy-800 hover:underline">
              {r.code}
            </Link>
            <PriorityBadge priority={r.priority} />
            <DeadlineBadge state={a.deadline.state} days={a.deadline.days} />
            <RequestStatusBadge status={r.status} />
          </div>
          <p className="text-sm text-slate-800">{r.description}</p>
          <p className="text-xs text-slate-500">
            {r.sector} · {r.responsible} · prazo {formatDateOnly(r.dueDate)}
          </p>
        </div>
        <div className="w-full md:w-60 md:shrink-0">
          <Progress value={a.progress} label="Separação" tone={complete ? "success" : "primary"} />
          <p className="mt-1 text-xs text-slate-500">
            {formatNumber(a.separated)} de {formatNumber(a.requested)} unidades
          </p>
        </div>
      </header>

      <div className="p-5">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Checklist de materiais da solicitação {r.code}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="pb-2 pr-3 font-semibold">Material</th>
                <th scope="col" className="pb-2 pr-3 text-right font-semibold">Necessário</th>
                <th scope="col" className="pb-2 pr-3 text-right font-semibold">Separado</th>
                <th scope="col" className="pb-2 pr-3 text-right font-semibold">Pendente</th>
                <th scope="col" className="pb-2 pr-3 text-right font-semibold">Disponível</th>
                <th scope="col" className="pb-2 pr-3 font-semibold">Situação</th>
                <th scope="col" className="pb-2 font-semibold">Registrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.items.map((item) => (
                <ChecklistRow
                  key={item.item.materialId}
                  item={item}
                  editable={isSeparating}
                  value={quantities[item.item.materialId] ?? String(item.pending)}
                  error={quantityError[item.item.materialId]}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [item.item.materialId]: v }))}
                  onSeparate={() => separateItem(item)}
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 lg:hidden">
          {a.items.map((item) => (
            <li key={item.item.materialId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.material?.name ?? item.item.materialId}</p>
                  <p className="text-xs text-slate-500">{item.material?.code} · {item.material?.location}</p>
                </div>
                <SituationBadge item={item} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div><dt>Necessário</dt><dd className="font-medium text-slate-800">{formatNumber(item.item.requested)} {item.material?.unit}</dd></div>
                <div><dt>Separado</dt><dd className="font-medium text-slate-800">{formatNumber(item.item.separated)} {item.material?.unit}</dd></div>
                <div><dt>Pendente</dt><dd className="font-medium text-slate-800">{formatNumber(item.pending)} {item.material?.unit}</dd></div>
                <div><dt>Disponível</dt><dd className="font-medium text-slate-800">{formatNumber(item.available)} {item.material?.unit}</dd></div>
              </dl>
              {isSeparating && item.pending > 0 && (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`qty-m-${r.id}-${item.item.materialId}`} className="mb-1 block text-xs font-medium text-slate-600">
                      Quantidade a separar
                    </label>
                    <input
                      id={`qty-m-${r.id}-${item.item.materialId}`}
                      type="number"
                      min={1}
                      max={item.pending}
                      inputMode="numeric"
                      value={quantities[item.item.materialId] ?? String(item.pending)}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [item.item.materialId]: e.target.value }))}
                      className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <Button size="md" onClick={() => separateItem(item)} disabled={busy}>
                    Separar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        {canStart && (
          <Button
            size="sm"
            onClick={() => run(() => changeRequestStatus(r.id, "Em separação"), "Separação iniciada", `${r.code} entrou em separação.`)}
            disabled={busy || blockers.length > 0}
            title={blockers.length > 0 ? blockers.join(" ") : undefined}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Iniciar separação
          </Button>
        )}
        {blockers.length > 0 && (
          <p role="note" className="basis-full text-xs font-medium text-amber-800">
            Início bloqueado por falta de material: {blockers.join(" ")}
          </p>
        )}
        {isSeparating && (
          <Button size="sm" variant="outline" onClick={() => run(() => separateAllPending(r.id), "Itens separados", `Todos os itens pendentes de ${r.code} foram separados.`)} disabled={busy || pendingItems.length === 0}>
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            Separar tudo pendente
          </Button>
        )}
        {(r.status === "Em análise" || isSeparating) && (
          <Button size="sm" variant="outline" className="text-amber-900" onClick={() => setConfirm("shortage")} disabled={busy}>
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Informar insuficiência
          </Button>
        )}
        {isSeparating && (
          <Button size="sm" onClick={() => setConfirm("complete")} disabled={busy || !complete} title={complete ? undefined : `Faltam ${pendingUnits} unidade(s)`}>
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            Concluir separação
          </Button>
        )}
        {r.status === "Pronta para disponibilização" && (
          <Button size="sm" onClick={() => setConfirm("deliver")} disabled={busy}>
            <Truck className="h-4 w-4" aria-hidden="true" />
            Marcar como concluída
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowPendencies((v) => !v)} aria-expanded={showPendencies}>
          {showPendencies ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showPendencies ? "Ocultar pendências" : "Visualizar pendências"}
        </Button>
        {isSeparating && !complete && (
          <p className="text-xs text-slate-500 md:ml-auto">Faltam {formatNumber(pendingUnits)} unidade(s) para concluir a separação.</p>
        )}
      </footer>

      {showPendencies && (
        <div className="space-y-3 border-t border-slate-100 p-5">
          {a.shortages.length > 0 ? (
            <ShortageAlert
              title="Materiais com diferença entre necessário e disponível"
              items={a.shortages.map<ShortageItem>((s) => ({
                key: s.item.materialId,
                name: `${s.material?.code ?? ""} · ${s.material?.name ?? s.item.materialId}`,
                unit: s.material?.unit ?? "un",
                required: s.pending,
                available: s.available,
                difference: s.difference,
                to: `/estoque/${s.item.materialId}`,
              }))}
            />
          ) : pendingItems.length > 0 ? (
            <p className="text-sm text-slate-700">
              Há {formatNumber(pendingUnits)} unidade(s) pendente(s), todas com material disponível.
            </p>
          ) : (
            <p className="text-sm text-slate-700">Nenhuma pendência: todos os itens foram separados.</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm === "shortage"}
        title="Informar insuficiência de materiais?"
        description={`A solicitação ${r.code} voltará para "Aguardando materiais" e a diferença ficará registrada no histórico.`}
        confirmLabel="Informar insuficiência"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(() => reportShortage(r.id), "Insuficiência registrada", `${r.code} aguarda materiais.`);
        }}
      />
      <ConfirmDialog
        open={confirm === "complete"}
        title="Concluir a separação?"
        description={`Todos os itens de ${r.code} estão separados. A solicitação passará para "Pronta para disponibilização".`}
        confirmLabel="Concluir separação"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(() => changeRequestStatus(r.id, "Pronta para disponibilização"), "Separação concluída", `${r.code} está pronta para disponibilização.`);
        }}
      />
      <ConfirmDialog
        open={confirm === "deliver"}
        title="Confirmar entrega à produção?"
        description={`Confirme que os materiais de ${r.code} foram retirados pela produção. A solicitação será concluída.`}
        confirmLabel="Confirmar entrega"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(() => changeRequestStatus(r.id, "Concluída"), "Solicitação concluída", `${r.code} foi entregue à produção.`);
        }}
      />
    </Card>
  );
}

function SituationBadge({ item }: { item: ItemAnalysis }) {
  if (item.pending === 0) return <Badge tone="success" icon={CircleCheck}>Separado</Badge>;
  if (item.isShortage) return <Badge tone="danger" icon={AlertTriangle}>Faltam {formatNumber(item.difference)}</Badge>;
  return <Badge tone="info">Disponível</Badge>;
}

function ChecklistRow({
  item,
  editable,
  value,
  error,
  onChange,
  onSeparate,
  busy,
}: {
  item: ItemAnalysis;
  editable: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onSeparate: () => void;
  busy: boolean;
}) {
  const unit = item.material?.unit ?? "un";
  // useId garante identificadores únicos no documento (várias solicitações na mesma tela).
  const id = useId();
  return (
    <tr className={cn("align-middle", item.isShortage && "bg-rose-50/50")}>
      <td className="py-3 pr-3">
        <p className="font-medium text-slate-900">{item.material?.name ?? item.item.materialId}</p>
        <p className="text-xs text-slate-500">{item.material?.code} · {item.material?.location}</p>
      </td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatNumber(item.item.requested)} {unit}</td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatNumber(item.item.separated)} {unit}</td>
      <td className="py-3 pr-3 text-right font-medium tabular-nums">{formatNumber(item.pending)} {unit}</td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatNumber(item.available)} {unit}</td>
      <td className="py-3 pr-3">
        <SituationBadge item={item} />
      </td>
      <td className="py-3">
        {editable && item.pending > 0 ? (
          <div className="flex items-start gap-2">
            <div>
              <label htmlFor={id} className="sr-only">
                Quantidade a separar de {item.material?.name ?? item.item.materialId}
              </label>
              <input
                id={id}
                type="number"
                min={1}
                max={item.pending}
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 aria-[invalid=true]:border-rose-500"
              />
              {error && (
                <p id={`${id}-error`} className="mt-1 text-xs text-rose-700">
                  {error}
                </p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={onSeparate} disabled={busy}>
              Separar
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-500">{item.pending === 0 ? "Concluído" : "Não disponível nesta etapa"}</span>
        )}
      </td>
    </tr>
  );
}
