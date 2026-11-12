/* ------------------------------------------------------------------ */
/* Serviço de solicitações de materiais.                              */
/* Concentra operações, validações, permissões e idempotência; as     */
/* telas apenas chamam estas funções. Mesmas assinaturas serão        */
/* mantidas nos repositórios Supabase (services/supabase).            */
/* ------------------------------------------------------------------ */
import type {
  AppNotification,
  HistoryEntry,
  ProductionRequest,
  RequestInput,
  RequestStatus,
} from "@/types";
import {
  analyzeAll,
  analyzeRequest,
  assertCanCancel,
  assertCanTransition,
  buildMaterialMetricsMap,
  canEditRequest,
  getPendingQty,
  getSeparationBlockers,
  isSeparationComplete,
  type RequestAnalysis,
} from "@/lib/businessRules";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { cancelRequestSchema, requestInputSchema } from "@/lib/schemas";
import { diffInDays } from "@/lib/utils";
import {
  consumeIdempotencyKey,
  createId,
  getDemoState,
  nextRequestCode,
  setDemoState,
  simulateLatency,
  type DemoState,
} from "./demo/demoDb";
import { createHistoryEntry, createNotification } from "./activityService";
import { requirePermission } from "./permissions";
import { pushUndoSnapshot } from "./undoService";

/* ------------------------------ Auxiliares -------------------------- */

function findRequest(state: DemoState, idOrCode: string): ProductionRequest {
  const request = state.requests.find((r) => r.id === idOrCode || r.code === idOrCode);
  if (!request) throw new NotFoundError("Solicitação não encontrada.");
  return request;
}

function analysisOf(state: DemoState, request: ProductionRequest): RequestAnalysis {
  const metrics = buildMaterialMetricsMap(state.materials, state.requests);
  const byId = Object.fromEntries(state.materials.map((m) => [m.id, m]));
  return analyzeRequest(request, byId, metrics);
}

function parseRequestInput(input: RequestInput): RequestInput {
  const result = requestInputSchema.safeParse(input);
  if (!result.success) {
    throw new BusinessRuleError(result.error.issues[0]?.message ?? "Dados da solicitação inválidos.");
  }
  return { ...result.data, notes: result.data.notes || undefined };
}

function assertItemsExist(items: RequestInput["items"], state: DemoState): void {
  for (const item of items) {
    const material = state.materials.find((m) => m.id === item.materialId);
    if (!material) {
      throw new BusinessRuleError("Um dos materiais selecionados não existe no estoque.");
    }
    if (!material.active) {
      throw new BusinessRuleError(`O material ${material.name} está desativado e não pode ser solicitado.`);
    }
  }
}

function sameItems(current: ProductionRequest["items"], next: RequestInput["items"]): boolean {
  if (current.length !== next.length) return false;
  return next.every((n) => current.some((c) => c.materialId === n.materialId && c.requested === n.requested));
}

function commitRequest(updated: ProductionRequest, entries: HistoryEntry[], notifications: AppNotification[] = []): void {
  setDemoState((s) => ({
    ...s,
    requests: s.requests.map((r) => (r.id === updated.id ? updated : r)),
    history: [...entries, ...s.history],
    notifications: [...notifications, ...s.notifications],
  }));
}

/* ------------------------------ Consultas --------------------------- */

export async function listRequests(): Promise<ProductionRequest[]> {
  await simulateLatency();
  return [...getDemoState().requests];
}

export async function listRequestAnalyses(): Promise<RequestAnalysis[]> {
  await simulateLatency();
  const state = getDemoState();
  return analyzeAll(state.requests, state.materials);
}

export async function getRequestAnalysis(idOrCode: string): Promise<RequestAnalysis> {
  await simulateLatency();
  const state = getDemoState();
  return analysisOf(state, findRequest(state, idOrCode));
}

/* ------------------------------ Cadastro ---------------------------- */

export async function createRequest(input: RequestInput, idempotencyKey?: string): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("request.create");
  if (idempotencyKey && !consumeIdempotencyKey(idempotencyKey)) {
    const existing = getDemoState().requests[0];
    if (existing) return existing;
    throw new BusinessRuleError("Esta solicitação já foi registrada (operação duplicada ignorada).");
  }
  const data = parseRequestInput(input);
  const state = getDemoState();
  assertItemsExist(data.items, state);
  if (diffInDays(data.dueDate) < 0) {
    throw new BusinessRuleError("O prazo não pode ser anterior à data de hoje.");
  }

  pushUndoSnapshot("Criação de solicitação");
  const now = new Date().toISOString();
  const request: ProductionRequest = {
    id: createId("req"),
    code: nextRequestCode(state.requests),
    description: data.description,
    sector: data.sector,
    responsible: data.responsible,
    priority: data.priority,
    status: "Pendente",
    createdAt: now,
    updatedAt: now,
    dueDate: data.dueDate,
    notes: data.notes,
    items: data.items.map((i) => ({ materialId: i.materialId, requested: i.requested, separated: 0 })),
    createdBy: state.user.name,
    updatedBy: state.user.name,
  };

  setDemoState((s) => ({
    ...s,
    requests: [request, ...s.requests],
    history: [
      createHistoryEntry({
        kind: "criacao",
        requestCode: request.code,
        actor: s.user.name,
        action: "Solicitação criada",
        to: "Pendente",
        details: `${request.items.length} material(is) solicitado(s)`,
      }),
      ...s.history,
    ],
    notifications: [
      createNotification({
        category: "nova",
        title: `Nova solicitação: ${request.code}`,
        message: request.description,
        link: `/solicitacoes/${request.id}`,
      }),
      ...s.notifications,
    ],
  }));

  return request;
}

/* ------------------------------ Edição ------------------------------ */

export async function updateRequest(idOrCode: string, input: RequestInput): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("request.edit");
  const state = getDemoState();
  const current = findRequest(state, idOrCode);

  if (!canEditRequest(current.status)) {
    throw new BusinessRuleError(
      current.status === "Cancelada"
        ? "Solicitações canceladas são somente para consulta. O histórico foi preservado."
        : "Solicitações concluídas não podem ser editadas.",
    );
  }

  const data = parseRequestInput(input);
  assertItemsExist(data.items, state);

  const itemsChanged = !sameItems(current.items, data.items);
  if (itemsChanged && (current.status === "Em separação" || current.status === "Pronta para disponibilização")) {
    throw new BusinessRuleError("Os materiais não podem ser alterados durante ou após a separação.");
  }

  const changes: string[] = [];
  if (current.description !== data.description) changes.push("descrição");
  if (current.sector !== data.sector) changes.push("setor");
  if (current.responsible !== data.responsible) changes.push("responsável");
  if (current.priority !== data.priority) changes.push("prioridade");
  if (current.dueDate !== data.dueDate) changes.push("prazo");
  if ((current.notes ?? "") !== (data.notes ?? "")) changes.push("observações");
  if (itemsChanged) changes.push("materiais");
  if (changes.length === 0) return current;

  pushUndoSnapshot(`Edição de ${current.code}`);
  const updated: ProductionRequest = {
    ...current,
    description: data.description,
    sector: data.sector,
    responsible: data.responsible,
    priority: data.priority,
    dueDate: data.dueDate,
    notes: data.notes,
    items: data.items.map((i) => ({
      materialId: i.materialId,
      requested: i.requested,
      separated: Math.min(i.requested, current.items.find((c) => c.materialId === i.materialId)?.separated ?? 0),
    })),
    updatedAt: new Date().toISOString(),
    updatedBy: state.user.name,
  };

  commitRequest(updated, [
    createHistoryEntry({
      kind: "edicao",
      requestCode: current.code,
      actor: state.user.name,
      action: "Solicitação editada",
      details: `Campos alterados: ${changes.join(", ")}`,
    }),
  ]);

  return updated;
}

/* ------------------------------ Status ------------------------------ */

export async function changeRequestStatus(
  idOrCode: string,
  to: RequestStatus,
  note?: string,
): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("request.status");
  if (to === "Cancelada") {
    throw new BusinessRuleError("Use a opção Cancelar solicitação, que exige o motivo do cancelamento.");
  }
  const state = getDemoState();
  const current = findRequest(state, idOrCode);

  assertCanTransition(current.status, to);

  const startingSeparation = current.status === "Em análise" || current.status === "Aguardando materiais";
  if (to === "Em separação" && startingSeparation) {
    const blockers = getSeparationBlockers(analysisOf(state, current));
    if (blockers.length > 0) {
      throw new BusinessRuleError(`Não é possível iniciar a separação. ${blockers.join(" ")}`);
    }
  }

  if (to === "Pronta para disponibilização" && !isSeparationComplete(current)) {
    throw new BusinessRuleError("Conclua a separação de todos os itens antes de marcar a solicitação como pronta.");
  }

  pushUndoSnapshot(`Mudança de status de ${current.code}`);
  const now = new Date().toISOString();
  const updated: ProductionRequest = {
    ...current,
    status: to,
    updatedAt: now,
    updatedBy: state.user.name,
    concludedAt: to === "Concluída" ? now : current.concludedAt,
  };

  const entries = [
    createHistoryEntry({
      kind: "status",
      requestCode: current.code,
      actor: state.user.name,
      action: "Mudança de status",
      from: current.status,
      to,
      details: note,
    }),
  ];

  const notifications =
    to === "Pronta para disponibilização"
      ? [
          createNotification({
            category: "separacao",
            title: `Separação concluída: ${current.code}`,
            message: "Itens separados e prontos para disponibilização.",
            link: `/solicitacoes/${current.id}`,
          }),
        ]
      : [];

  commitRequest(updated, entries, notifications);
  return updated;
}

/* ---------------------------- Cancelamento -------------------------- */

export async function cancelRequest(idOrCode: string, reason: string): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("request.cancel");
  const parsed = cancelRequestSchema.safeParse({ reason });
  if (!parsed.success) {
    throw new BusinessRuleError(parsed.error.issues[0]?.message ?? "Motivo de cancelamento inválido.");
  }
  const state = getDemoState();
  const current = findRequest(state, idOrCode);
  assertCanCancel(current.status);

  pushUndoSnapshot(`Cancelamento de ${current.code}`);
  const now = new Date().toISOString();
  const separatedCount = current.items.reduce((sum, i) => sum + i.separated, 0);
  const updated: ProductionRequest = {
    ...current,
    status: "Cancelada",
    updatedAt: now,
    updatedBy: state.user.name,
    cancelReason: parsed.data.reason.trim(),
    cancelledAt: now,
    cancelledBy: state.user.name,
  };

  commitRequest(
    updated,
    [
      createHistoryEntry({
        kind: "cancelamento",
        requestCode: current.code,
        actor: state.user.name,
        action: "Solicitação cancelada",
        from: current.status,
        to: "Cancelada",
        details:
          `Motivo: ${parsed.data.reason.trim()}` +
          (separatedCount > 0
            ? ` ${separatedCount} unidade(s) já separada(s) permanecem registradas; as reservas pendentes foram liberadas.`
            : " Nenhum item havia sido separado; as reservas pendentes foram liberadas."),
      }),
    ],
    [
      createNotification({
        category: "cancelamento",
        title: `Solicitação cancelada: ${current.code}`,
        message: parsed.data.reason.trim(),
        link: `/solicitacoes/${current.id}`,
      }),
    ],
  );

  return updated;
}

/* ----------------------------- Separação ---------------------------- */

interface SeparationLine {
  materialId: string;
  quantity?: number;
}

async function applySeparation(idOrCode: string, lines: SeparationLine[] | "all"): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("separation.execute");
  const state = getDemoState();
  const current = findRequest(state, idOrCode);

  if (current.status !== "Em separação") {
    throw new BusinessRuleError('A separação só pode ser registrada quando a solicitação estiver "Em separação".');
  }

  const targets: SeparationLine[] =
    lines === "all"
      ? current.items.filter((i) => getPendingQty(i) > 0).map((i) => ({ materialId: i.materialId }))
      : lines;

  if (targets.length === 0) {
    throw new BusinessRuleError("Não há itens pendentes de separação.");
  }

  pushUndoSnapshot(`Separação em ${current.code}`);
  let items = current.items;
  const entries: HistoryEntry[] = [];

  for (const target of targets) {
    const item = items.find((i) => i.materialId === target.materialId);
    if (!item) throw new NotFoundError("Material não encontrado nesta solicitação.");

    const pending = getPendingQty(item);
    const quantity = target.quantity ?? pending;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BusinessRuleError("Informe uma quantidade inteira maior que zero.");
    }
    if (quantity > pending) {
      throw new BusinessRuleError(`A quantidade informada (${quantity}) excede o pendente (${pending}).`);
    }

    const material = state.materials.find((m) => m.id === target.materialId);
    items = items.map((i) =>
      i.materialId === target.materialId ? { ...i, separated: i.separated + quantity } : i,
    );
    entries.push(
      createHistoryEntry({
        kind: "separacao",
        requestCode: current.code,
        actor: state.user.name,
        action: "Separação registrada",
        details: `${quantity} ${material?.unit ?? "un"} de ${material?.name ?? target.materialId}`,
      }),
    );
  }

  const updated: ProductionRequest = { ...current, items, updatedAt: new Date().toISOString(), updatedBy: state.user.name };
  commitRequest(updated, entries);
  return updated;
}

/** Registra a separação de uma quantidade de um material. */
export function registerSeparation(idOrCode: string, materialId: string, quantity: number): Promise<ProductionRequest> {
  return applySeparation(idOrCode, [{ materialId, quantity }]);
}

/** Marca todos os itens pendentes como separados. */
export function separateAllPending(idOrCode: string): Promise<ProductionRequest> {
  return applySeparation(idOrCode, "all");
}

/** Informa insuficiência de materiais e move a solicitação para "Aguardando materiais". */
export async function reportShortage(idOrCode: string, note?: string): Promise<ProductionRequest> {
  await simulateLatency();
  requirePermission("request.status");
  const state = getDemoState();
  const current = findRequest(state, idOrCode);
  assertCanTransition(current.status, "Aguardando materiais");

  const analysis = analysisOf(state, current);
  const summary =
    analysis.shortages.length > 0
      ? analysis.shortages
          .map(
            (s) =>
              `${s.material?.name ?? s.item.materialId}: necessário ${s.pending}, disponível ${s.available} (faltam ${s.difference})`,
          )
          .join("; ")
      : "Insuficiência informada manualmente.";

  pushUndoSnapshot(`Insuficiência em ${current.code}`);
  const updated: ProductionRequest = {
    ...current,
    status: "Aguardando materiais",
    updatedAt: new Date().toISOString(),
    updatedBy: state.user.name,
  };

  commitRequest(
    updated,
    [
      createHistoryEntry({
        kind: "estoque",
        requestCode: current.code,
        actor: state.user.name,
        action: "Insuficiência de materiais informada",
        from: current.status,
        to: "Aguardando materiais",
        details: note ? `${summary}. Observação: ${note}` : summary,
      }),
    ],
    [
      createNotification({
        category: "estoque",
        title: `Insuficiência de materiais: ${current.code}`,
        message: summary,
        link: `/solicitacoes/${current.id}`,
      }),
    ],
  );

  return updated;
}
