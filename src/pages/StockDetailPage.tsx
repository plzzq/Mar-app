import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Info, Pencil, Power, PowerOff, Settings2, Undo2 } from "lucide-react";
import { DeadlineBadge, MovementTypeBadge, RequestStatusBadge, StockStatusBadge } from "@/components/common/DomainBadges";
import { PageHeader, type Crumb } from "@/components/common/PageHeader";
import { ShortageAlert, type ShortageItem } from "@/components/common/Widgets";
import { MaterialFormModal, MovementModal, ReverseModal } from "@/components/stock/StockModals";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@/hooks/useQuery";
import { STOCK_STATUS_META, getDeadline } from "@/lib/businessRules";
import { getErrorMessage } from "@/lib/errors";
import { cn, formatDateOnly, formatDateTime, formatNumber } from "@/lib/utils";
import { getMaterial, listMaterialRequests, listMovements, setMaterialActive } from "@/services/stockService";
import type { Material, StockMovement } from "@/types";

export function StockDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { can } = usePermissions();
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [editOpen, setEditOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [activeReason, setActiveReason] = useState("");
  const [reverseTarget, setReverseTarget] = useState<StockMovement | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useQuery(async () => {
    const [material, links, movements] = await Promise.all([getMaterial(id), listMaterialRequests(id), listMovements(id)]);
    return { material, links, movements };
  }, [id]);

  const crumbs: Crumb[] = [
    { label: "Visão geral", to: "/" },
    { label: "Estoque", to: "/estoque" },
    { label: data?.material.code ?? "Material" },
  ];

  const reversedIds = useMemo(
    () => new Set((data?.movements ?? []).filter((m) => m.reversalOf).map((m) => m.reversalOf as string)),
    [data],
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Carregando material…" breadcrumbs={crumbs} />
        <LoadingState rows={4} />
      </>
    );
  }

  if (error || !data) {
    const notFound = error?.message === "Material não encontrado.";
    return (
      <>
        <PageHeader title="Material" breadcrumbs={crumbs} />
        <ErrorState
          title={notFound ? "Material não encontrado" : "Não foi possível carregar o material"}
          message={error?.message}
          onRetry={notFound ? undefined : refetch}
        />
        <div className="mt-4 text-center">
          <Link to="/estoque" className="text-sm font-medium text-navy-700 hover:underline">
            Voltar para o estoque
          </Link>
        </div>
      </>
    );
  }

  const m = data.material;
  const critical = m.status === "Insuficiente" || m.status === "Indisponível";
  const demand = m.reserved + m.openDemand;
  const canMove = can("stock.move") && m.active;
  const canEdit = can("material.edit");
  const canToggleActive = can("material.deactivate");

  const shortageItems: ShortageItem[] = m.shortfall > 0
    ? [{ key: m.id, name: `${m.code} · ${m.name}`, unit: m.unit, required: demand, available: m.available, difference: m.shortfall }]
    : [];

  const openMovement = (type: "entrada" | "saida" | "ajuste") => {
    setMovementType(type);
    setMovementOpen(true);
  };

  const handleToggleActive = async () => {
    setBusy(true);
    try {
      const updated = await setMaterialActive(m.id, !m.active, activeReason.trim() || undefined);
      toast({
        title: updated.active ? "Item reativado" : "Item desativado",
        description: updated.active ? `${m.code} voltou às seleções.` : `${m.code} preservado no histórico e fora das seleções.`,
        variant: "success",
      });
      setActiveOpen(false);
      setActiveReason("");
    } catch (err) {
      toast({ title: "Não foi possível alterar", description: getErrorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const costText = m.cost === undefined ? "—" : m.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const metrics = [
    { label: "Disponível", value: `${formatNumber(m.available)} ${m.unit}`, hint: "Quantidade física" },
    { label: "Reservado", value: `${formatNumber(m.reserved)} ${m.unit}`, hint: "Em separação" },
    { label: "Saldo livre", value: `${formatNumber(m.freeBalance)} ${m.unit}`, hint: "Disponível − reservado" },
    { label: "Demanda em aberto", value: `${formatNumber(m.openDemand)} ${m.unit}`, hint: "Solicitações ainda não separadas" },
    { label: "Saldo projetado", value: `${formatNumber(m.projected)} ${m.unit}`, hint: "Após a demanda em aberto" },
    { label: "Estoque mínimo", value: `${formatNumber(m.minimumStock)} ${m.unit}`, hint: "Referência de reposição" },
  ];

  return (
    <>
      <PageHeader
        title={m.name}
        description={m.description}
        breadcrumbs={crumbs}
        actions={
          <>
            <Button variant="outline" onClick={() => openMovement("entrada")} disabled={!canMove} title={!can("stock.move") ? "Seu perfil não tem permissão para movimentar." : !m.active ? "Item desativado." : undefined}>
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              Entrada
            </Button>
            <Button variant="outline" onClick={() => openMovement("saida")} disabled={!canMove} title={!can("stock.move") ? "Seu perfil não tem permissão para movimentar." : !m.active ? "Item desativado." : undefined}>
              <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
              Saída
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!canEdit} title={!canEdit ? "Seu perfil não tem permissão para editar." : undefined}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{m.code}</Badge>
        <StockStatusBadge status={m.status} />
        <Badge tone="info">{m.category}</Badge>
        <Badge tone="neutral">Localização {m.location}</Badge>
        {!m.active && <Badge tone="neutral">Inativo</Badge>}
      </div>

      {!m.active && (
        <div role="note" className="mb-4 rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
          Item desativado: preservado no histórico, fora das seleções de novas solicitações e sem movimentação.
          {canToggleActive && " Use “Reativar” para voltar a utilizá-lo."}
        </div>
      )}

      {shortageItems.length > 0 && (
        <ShortageAlert items={shortageItems} title="Demanda acima do disponível" className="mb-4" />
      )}
      {m.status === "Indisponível" && shortageItems.length === 0 && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Não há quantidade física disponível deste material no almoxarifado.
        </div>
      )}

      <section aria-label="Quantidades do material" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", item.label === "Saldo projetado" && m.projected < 0 ? "text-rose-700" : "text-navy-900")}>
              {item.value}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Card>
            <CardHeader title="Informações do material" icon={Info} />
            <dl className="space-y-4 p-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Unidade</dt>
                  <dd className="mt-1 text-slate-800">{m.unit}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Solicitações em aberto</dt>
                  <dd className="mt-1 text-slate-800">{m.requestCount}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Fornecedor</dt>
                  <dd className="mt-1 text-slate-800">{m.supplier ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Custo unitário</dt>
                  <dd className="mt-1 text-slate-800">{costText}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Situação</dt>
                <dd className="mt-1 space-y-2">
                  <StockStatusBadge status={m.status} />
                  <p className="text-xs text-slate-600">{STOCK_STATUS_META[m.status].description}</p>
                </dd>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button variant="outline" size="sm" onClick={() => openMovement("ajuste")} disabled={!canMove}>
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Ajuste
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveOpen(true)}
                  disabled={!canToggleActive}
                  title={!canToggleActive ? "A desativação exige perfil administrador." : undefined}
                >
                  {m.active ? <PowerOff className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
                  {m.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Movimentações" description="Entradas, saídas, ajustes e estornos (sem apagar o original)" icon={Info} />
            {data.movements.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sem movimentações" description="A movimentação inicial do cadastro e as próximas operações aparecem aqui." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.movements.slice(0, 8).map((mov) => (
                  <li key={mov.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <MovementTypeBadge type={mov.type} />
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {mov.type === "saida" ? "−" : "+"}{formatNumber(mov.quantity)} {m.unit}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500" title={mov.reason}>{mov.reason}</p>
                      <p className="text-xs text-slate-500">
                        <time dateTime={mov.timestamp}>{formatDateTime(mov.timestamp)}</time> · {mov.actor} · saldo {formatNumber(mov.balanceAfter)}
                      </p>
                    </div>
                    {mov.type !== "estorno" && !reversedIds.has(mov.id) && can("stock.reverse") && (
                      <button
                        type="button"
                        onClick={() => setReverseTarget(mov)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Estornar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Solicitações que utilizam este material"
            description={critical ? "Compare a quantidade necessária com a disponível para cada solicitação." : "Quantidades necessárias por solicitação."}
            icon={Boxes}
          />
          {data.links.length === 0 ? (
            <p className="p-5 text-sm text-slate-600">Nenhuma solicitação utiliza este material.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Solicitações relacionadas ao material {m.code}</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Solicitação</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Prazo</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Necessário</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Disponível</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.links.map((l) => (
                      <tr key={`${l.request.id}-${l.item.materialId}`} className={cn(l.isShortage && "bg-rose-50/40")}>
                        <td className="px-4 py-3">
                          <Link to={`/solicitacoes/${l.request.id}`} className="font-semibold text-navy-800 hover:underline">
                            {l.request.code}
                          </Link>
                          <span className="block max-w-xs truncate text-xs text-slate-500">{l.request.description}</span>
                        </td>
                        <td className="px-4 py-3"><RequestStatusBadge status={l.request.status} /></td>
                        <td className="px-4 py-3">
                          <DeadlineBadge state={getDeadline(l.request).state} days={getDeadline(l.request).days} />
                          <span className="block text-xs text-slate-500">{formatDateOnly(l.request.dueDate)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.pending)} {m.unit}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.available)} {m.unit}</td>
                        <td className="px-4 py-3">
                          {l.isShortage ? (
                            <Badge tone="danger">Faltam {formatNumber(l.difference)} {m.unit}</Badge>
                          ) : (
                            <Badge tone="success">Atendível</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 p-4 lg:hidden">
                {data.links.map((l) => (
                  <li key={`${l.request.id}-${l.item.materialId}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/solicitacoes/${l.request.id}`} className="font-semibold text-navy-800 hover:underline">
                        {l.request.code}
                      </Link>
                      <RequestStatusBadge status={l.request.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{l.request.description}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div><dt>Necessário</dt><dd className="font-medium text-slate-800">{formatNumber(l.pending)} {m.unit}</dd></div>
                      <div><dt>Disponível</dt><dd className="font-medium text-slate-800">{formatNumber(l.available)} {m.unit}</dd></div>
                    </dl>
                    <div className="mt-3">
                      {l.isShortage ? <Badge tone="danger">Faltam {formatNumber(l.difference)} {m.unit}</Badge> : <Badge tone="success">Atendível</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <MovementModal
        open={movementOpen}
        material={m}
        defaultType={movementType}
        onClose={() => setMovementOpen(false)}
        onSaved={(duplicate) => {
          toast({
            title: duplicate ? "Movimentação já registrada" : "Movimentação registrada",
            description: duplicate ? "A repetição foi ignorada (idempotência)." : undefined,
            variant: duplicate ? "warning" : "success",
          });
        }}
      />
      <MaterialFormModal
        open={editOpen}
        initial={m as Material}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          toast({ title: "Cadastro atualizado", description: `${updated.code} · ${updated.name}.`, variant: "success" });
        }}
      />
      <ReverseModal
        open={reverseTarget !== null}
        movement={reverseTarget}
        material={m as Material}
        onClose={() => setReverseTarget(null)}
        onSaved={() => {
          toast({ title: "Estorno registrado", description: "A compensação foi registrada sem apagar o original.", variant: "success" });
        }}
      />
      <Modal
        open={activeOpen}
        onClose={() => setActiveOpen(false)}
        title={m.active ? `Desativar ${m.code}?` : `Reativar ${m.code}?`}
        description={
          m.active
            ? "O item sai das seleções, mas todo o histórico é preservado. Só é possível desativar sem solicitações em aberto."
            : "O item volta às seleções de novas solicitações e movimentações."
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setActiveOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant={m.active ? "danger" : "primary"} onClick={handleToggleActive} loading={busy}>
              {m.active ? "Desativar item" : "Reativar item"}
            </Button>
          </>
        }
      >
        <Textarea
          id="active-reason"
          label="Motivo (opcional)"
          value={activeReason}
          onChange={(e) => setActiveReason(e.target.value)}
          maxLength={200}
          hint="Ex.: produto descontinuado, substituído por outro modelo."
        />
      </Modal>
    </>
  );
}
