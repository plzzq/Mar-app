import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Ban, CircleCheck, FileText, History, Package, Pencil, PackageCheck, TriangleAlert } from "lucide-react";
import { DeadlineBadge, PriorityBadge, RequestStatusBadge } from "@/components/common/DomainBadges";
import { PageHeader, type Crumb } from "@/components/common/PageHeader";
import { ShortageAlert, type ShortageItem } from "@/components/common/Widgets";
import { HistoryTimeline, StatusStepper } from "@/components/requests/RequestParts";
import { CancelRequestModal } from "@/components/stock/StockModals";
import { Badge, Button, Card, CardHeader, ErrorState, LoadingState, Progress, buttonClasses } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/forms";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@/hooks/useQuery";
import {
  STATUS_META,
  STATUS_TRANSITIONS,
  TRANSITIONS_REQUIRING_CONFIRMATION,
  canCancel,
  canEditRequest,
  getSeparationBlockers,
  type ItemAnalysis,
} from "@/lib/businessRules";
import { getErrorMessage } from "@/lib/errors";
import { formatDateOnly, formatDateTime, formatNumber } from "@/lib/utils";
import { listHistory } from "@/services/activityService";
import { cancelRequest, changeRequestStatus, getRequestAnalysis, reportShortage } from "@/services/requestsService";
import { undoLastAction } from "@/services/undoService";
import type { RequestStatus } from "@/types";

function ItemSituation({ item }: { item: ItemAnalysis }) {
  if (item.pending === 0) return <Badge tone="success" icon={CircleCheck}>Separado</Badge>;
  if (item.isShortage) return <Badge tone="danger" icon={TriangleAlert}>Insuficiente</Badge>;
  return <Badge tone="info">Pendente</Badge>;
}

export function RequestDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);
  const [shortageOpen, setShortageOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [observation, setObservation] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useQuery(async () => {
    const analysis = await getRequestAnalysis(id);
    const history = await listHistory(analysis.request.code);
    return { analysis, history };
  }, [id]);

  const code = data?.analysis.request.code;
  const crumbs: Crumb[] = [
    { label: "Visão geral", to: "/" },
    { label: "Solicitações", to: "/solicitacoes" },
    { label: code ?? "Detalhes" },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Carregando solicitação…" breadcrumbs={crumbs} />
        <LoadingState rows={5} />
      </>
    );
  }

  if (error || !data) {
    const notFound = error?.message === "Solicitação não encontrada.";
    return (
      <>
        <PageHeader title="Solicitação" breadcrumbs={crumbs} />
        <ErrorState
          title={notFound ? "Solicitação não encontrada" : "Não foi possível carregar a solicitação"}
          message={error?.message}
          onRetry={notFound ? undefined : refetch}
        />
        <div className="mt-4 text-center">
          <Link to="/solicitacoes" className="text-sm font-medium text-navy-700 hover:underline">
            Voltar para a lista de solicitações
          </Link>
        </div>
      </>
    );
  }

  const { request: r, items, progress, deadline, shortages, requested, separated, pending } = data.analysis;
  const editable = canEditRequest(r.status);
  const cancellable = canCancel(r.status);
  const canEdit = editable && can("request.edit");
  const canCancelNow = cancellable && can("request.cancel");
  const canStartSeparation = r.status === "Em análise" || r.status === "Aguardando materiais";
  const blockers = canStartSeparation ? getSeparationBlockers(data.analysis) : [];
  const canReportShortage = r.status === "Em análise" || r.status === "Em separação";
  const transitions = STATUS_TRANSITIONS[r.status].filter((s) => s !== "Aguardando materiais");

  const shortageItems: ShortageItem[] = shortages.map((s) => ({
    key: s.item.materialId,
    name: `${s.material?.code ?? ""} · ${s.material?.name ?? s.item.materialId}`,
    unit: s.material?.unit ?? "un",
    required: s.pending,
    available: s.available,
    difference: s.difference,
    to: `/estoque/${s.item.materialId}`,
  }));

  const notifyUndone = () => {
    const label = undoLastAction(user.name);
    toast({
      title: label ? "Operação desfeita" : "Nada para desfazer",
      description: label ?? undefined,
      variant: label ? "success" : "warning",
    });
  };

  const execute = async (action: () => Promise<unknown>, successTitle: string, successDescription: string, undoable = true) => {
    setBusy(true);
    try {
      await action();
      toast({
        title: successTitle,
        description: successDescription,
        variant: "success",
        ...(undoable ? { action: { label: "Desfazer", onClick: notifyUndone } } : {}),
      });
    } catch (err) {
      toast({ title: "Ação não permitida", description: getErrorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
      setPendingStatus(null);
      setShortageOpen(false);
      setCancelOpen(false);
      setObservation("");
    }
  };

  const changeStatus = (to: RequestStatus) =>
    execute(
      () => changeRequestStatus(r.id, to),
      "Status atualizado",
      `${r.code} foi movida para "${to}".`,
    );

  const handleStatusClick = (to: RequestStatus) => {
    if (TRANSITIONS_REQUIRING_CONFIRMATION.includes(to)) setPendingStatus(to);
    else void changeStatus(to);
  };

  const submitShortage = () =>
    execute(
      () => reportShortage(r.id, observation.trim() || undefined),
      "Insuficiência registrada",
      `${r.code} aguarda materiais. O registro foi incluído no histórico.`,
    );

  return (
    <>
      <PageHeader
        title={r.code}
        description={r.description}
        breadcrumbs={crumbs}
        actions={
          <>
            {canEdit ? (
              <Link to={`/solicitacoes/${r.id}/editar`} className={buttonClasses("outline")}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Link>
            ) : (
              <Button
                variant="outline"
                disabled
                title={!editable ? "Solicitações concluídas ou canceladas são somente para consulta." : "Seu perfil não tem permissão para editar."}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
            )}
            {canCancelNow && (
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={busy} className="text-rose-700">
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancelar solicitação
              </Button>
            )}
          </>
        }
      />

      {r.status === "Cancelada" && (
        <div role="note" className="mb-4 rounded-lg border border-stone-300 bg-stone-100 p-4 text-sm text-stone-800">
          <p className="font-semibold">Solicitação cancelada{r.cancelledAt ? ` em ${formatDateTime(r.cancelledAt)}` : ""}{r.cancelledBy ? ` por ${r.cancelledBy}` : ""}.</p>
          {r.cancelReason && <p className="mt-1">Motivo: {r.cancelReason}</p>}
          <p className="mt-1 text-xs text-stone-600">Registro preservado para histórico. As reservas pendentes foram liberadas.</p>
        </div>
      )}

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={r.status} />
          <PriorityBadge priority={r.priority} />
          <DeadlineBadge state={deadline.state} days={deadline.days} />
        </div>
        <p className="mt-3 text-sm text-slate-600">{STATUS_META[r.status].description}</p>
        <div className="mt-5">
          <StatusStepper status={r.status} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Dados da solicitação" icon={FileText} />
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Setor solicitante</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{r.sector}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Responsável</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{r.responsible}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Data de criação</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDateTime(r.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Prazo de atendimento</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDateOnly(r.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Última atualização</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDateTime(r.updatedAt)}</dd>
              </div>
              {r.concludedAt && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Concluída em</dt>
                  <dd className="mt-1 text-sm text-slate-800">{formatDateTime(r.concludedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Criada por</dt>
                <dd className="mt-1 text-sm text-slate-800">{r.createdBy}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Atualizada por</dt>
                <dd className="mt-1 text-sm text-slate-800">{r.updatedBy}</dd>
              </div>
              {r.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Observações</dt>
                  <dd className="mt-1 text-sm text-slate-800">{r.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Materiais solicitados" description="Necessário, separado, pendente e disponível para esta solicitação" icon={Package} />
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Itens da solicitação {r.code}</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Material</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Necessário</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Separado</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Pendente</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Disponível</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((a) => (
                    <tr key={a.item.materialId}>
                      <td className="px-5 py-3">
                        <Link to={`/estoque/${a.item.materialId}`} className="font-medium text-navy-800 hover:underline">
                          {a.material?.name ?? a.item.materialId}
                        </Link>
                        <span className="block text-xs text-slate-500">{a.material?.code} · {a.material?.location}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(a.item.requested)} {a.material?.unit}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(a.item.separated)} {a.material?.unit}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(a.pending)} {a.material?.unit}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(a.available)} {a.material?.unit}</td>
                      <td className="px-4 py-3"><ItemSituation item={a} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 p-4 lg:hidden">
              {items.map((a) => (
                <li key={a.item.materialId} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/estoque/${a.item.materialId}`} className="font-medium text-navy-800 hover:underline">
                        {a.material?.name ?? a.item.materialId}
                      </Link>
                      <p className="text-xs text-slate-500">{a.material?.code}</p>
                    </div>
                    <ItemSituation item={a} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div><dt>Necessário</dt><dd className="font-medium text-slate-800">{formatNumber(a.item.requested)} {a.material?.unit}</dd></div>
                    <div><dt>Separado</dt><dd className="font-medium text-slate-800">{formatNumber(a.item.separated)} {a.material?.unit}</dd></div>
                    <div><dt>Pendente</dt><dd className="font-medium text-slate-800">{formatNumber(a.pending)} {a.material?.unit}</dd></div>
                    <div><dt>Disponível</dt><dd className="font-medium text-slate-800">{formatNumber(a.available)} {a.material?.unit}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            {shortageItems.length > 0 && (
              <div className="p-5 pt-0">
                <ShortageAlert items={shortageItems} title="Diferença entre necessário e disponível" />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico desta solicitação" description="Criação, edições, status, separação e cancelamento preservados" icon={History} />
            <div className="p-5">
              <HistoryTimeline entries={data.history} emptyText="Nenhum registro de histórico para esta solicitação." />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ações" description="Mudanças permitidas pelo fluxo de status" icon={ArrowRight} />
            <div className="space-y-2 p-5">
              {transitions.length === 0 && (
                <p className="text-sm text-slate-600">Não há mudanças de status disponíveis nesta etapa.</p>
              )}
              {transitions.map((to, index) => (
                <Button
                  key={to}
                  variant={index === transitions.length - 1 && to !== "Em análise" ? "primary" : "outline"}
                  className="w-full justify-between"
                  disabled={busy || (to === "Em separação" && blockers.length > 0)}
                  onClick={() => handleStatusClick(to)}
                >
                  <span>
                    {to === "Em separação"
                      ? r.status === "Pronta para disponibilização"
                        ? "Reabrir separação"
                        : "Iniciar separação"
                      : `Mover para "${to}"`}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ))}
              {canReportShortage && (
                <Button variant="outline" className="w-full justify-start" disabled={busy} onClick={() => setShortageOpen(true)}>
                  <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  Informar insuficiência de materiais
                </Button>
              )}
              {canCancelNow && (
                <Button variant="outline" className="w-full justify-start text-rose-700" disabled={busy} onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Cancelar solicitação
                </Button>
              )}
              {blockers.length > 0 && (
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                  <p className="font-semibold">Separação bloqueada por falta de material:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Progresso da separação" icon={PackageCheck} />
            <div className="space-y-4 p-5">
              <Progress value={progress} label="Itens separados" tone={progress === 100 ? "success" : "primary"} />
              <p className="text-sm text-slate-600">
                {formatNumber(separated)} de {formatNumber(requested)} unidades separadas · {formatNumber(pending)} pendentes
              </p>
              <Link to="/separacao" className={buttonClasses("outline", "sm", "w-full")}>
                Abrir separação de materiais
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Confirmar mudança de status"
        description={`Confirme a mudança de ${r.code} para "${pendingStatus ?? ""}". Esta ação fica registrada no histórico.`}
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={() => pendingStatus && void changeStatus(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
      />

      <CancelRequestModal
        open={cancelOpen}
        requestCode={r.code}
        separatedCount={separated}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) =>
          void execute(() => cancelRequest(r.id, reason), "Solicitação cancelada", `${r.code} foi cancelada com motivo registrado.`)
        }
      />

      <Modal
        open={shortageOpen}
        onClose={() => setShortageOpen(false)}
        title="Informar insuficiência de materiais"
        description="A solicitação passará para “Aguardando materiais” e a diferença ficará registrada no histórico."
        footer={
          <>
            <Button variant="outline" onClick={() => setShortageOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submitShortage} loading={busy}>
              Registrar insuficiência
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {shortageItems.length > 0 && <ShortageAlert items={shortageItems} title="Diferenças identificadas" />}
          <Textarea
            id="shortage-note"
            label="Observação (opcional)"
            hint="Ex.: fornecedor informou prazo de reposição para a próxima semana."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            maxLength={300}
          />
        </div>
      </Modal>
    </>
  );
}
