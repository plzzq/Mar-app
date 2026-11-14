/* ------------------------------------------------------------------ */
/* Serviço de estoque: cadastro, movimentações rastreáveis, estorno,  */
/* desativação. Mesmas assinaturas serão mantidas nos repositórios    */
/* Supabase (services/supabase). A quantidade NUNCA é editada         */
/* diretamente: toda alteração de saldo gera uma movimentação.        */
/* ------------------------------------------------------------------ */
import type { Material, MaterialInput, MovementInput, ProductionRequest, StockMovement } from "@/types";
import {
  analyzeRequest,
  applyMovementBalance,
  buildMaterialMetricsMap,
  computeMaterialMetrics,
  type ItemAnalysis,
  type MaterialMetrics,
  OPEN_STATUSES,
} from "@/lib/businessRules";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { materialInputSchema, movementInputSchema } from "@/lib/schemas";
import { createHistoryEntry } from "./activityService";
import {
  consumeIdempotencyKey,
  createId,
  getDemoState,
  nextMaterialCode,
  setDemoState,
  simulateLatency,
  type DemoState,
} from "./demo/demoDb";
import { requirePermission } from "./permissions";
import { pushUndoSnapshot } from "./undoService";

export type MaterialView = Material & MaterialMetrics & { requestCount: number };

export type MaterialRequestLink = ItemAnalysis & { request: ProductionRequest };

function buildViews(state: DemoState): MaterialView[] {
  return state.materials.map((material) => {
    const metrics = computeMaterialMetrics(material, state.requests);
    return {
      ...material,
      ...metrics,
      requestCount: state.requests.filter(
        (r) => r.status !== "Concluída" && r.status !== "Cancelada" && r.items.some((i) => i.materialId === material.id),
      ).length,
    };
  });
}

function findMaterial(state: DemoState, idOrCode: string): Material {
  const material = state.materials.find((m) => m.id === idOrCode || m.code.toLowerCase() === idOrCode.toLowerCase());
  if (!material) throw new NotFoundError("Material não encontrado.");
  return material;
}

function parseMaterialInput(input: MaterialInput): MaterialInput {
  const result = materialInputSchema.safeParse(input);
  if (!result.success) {
    throw new BusinessRuleError(result.error.issues[0]?.message ?? "Dados do material inválidos.");
  }
  return {
    ...result.data,
    supplier: result.data.supplier?.trim() || undefined,
    cost: result.data.cost,
  };
}

function assertUniqueCode(code: string, state: DemoState, exceptId?: string): void {
  const clash = state.materials.find(
    (m) => m.code.toLowerCase() === code.toLowerCase() && m.id !== exceptId,
  );
  if (clash) {
    throw new BusinessRuleError(`O código ${code} já está em uso por "${clash.name}".`);
  }
}

/* ------------------------------ Consultas --------------------------- */

export async function listMaterials(): Promise<MaterialView[]> {
  await simulateLatency();
  return buildViews(getDemoState());
}

export async function getMaterial(idOrCode: string): Promise<MaterialView> {
  await simulateLatency();
  const view = buildViews(getDemoState()).find((m) => m.id === idOrCode || m.code.toLowerCase() === idOrCode.toLowerCase());
  if (!view) throw new NotFoundError("Material não encontrado.");
  return view;
}

export async function listMovements(materialId?: string): Promise<StockMovement[]> {
  await simulateLatency(120);
  return getDemoState()
    .movements.filter((m) => !materialId || m.materialId === materialId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Solicitações que utilizam um material, com a análise de disponibilidade de cada item. */
export async function listMaterialRequests(materialId: string): Promise<MaterialRequestLink[]> {
  await simulateLatency(160);
  const state = getDemoState();
  const metrics = buildMaterialMetricsMap(state.materials, state.requests);
  const byId = Object.fromEntries(state.materials.map((m) => [m.id, m]));

  return state.requests
    .flatMap((request) =>
      analyzeRequest(request, byId, metrics)
        .items.filter((item) => item.item.materialId === materialId)
        .map((item) => ({ ...item, request })),
    )
    .sort((a, b) => {
      const aOpen = OPEN_STATUSES.includes(a.request.status) ? 0 : 1;
      const bOpen = OPEN_STATUSES.includes(b.request.status) ? 0 : 1;
      return aOpen - bOpen || a.request.dueDate.localeCompare(b.request.dueDate);
    });
}

/* ------------------------------ Cadastro ---------------------------- */

export async function createMaterial(input: MaterialInput): Promise<Material> {
  await simulateLatency();
  requirePermission("material.create");
  const data = parseMaterialInput(input);
  const state = getDemoState();
  assertUniqueCode(data.code, state);

  pushUndoSnapshot(`Cadastro de ${data.code}`);
  const material: Material = {
    id: createId("mat"),
    code: data.code.toUpperCase(),
    name: data.name,
    description: data.description,
    category: data.category,
    available: data.available,
    unit: data.unit,
    location: data.location,
    minimumStock: data.minimumStock,
    supplier: data.supplier,
    cost: data.cost,
    active: data.active,
  };

  setDemoState((s) => ({
    ...s,
    materials: [material, ...s.materials],
    movements:
      data.available > 0
        ? [
            {
              id: createId("mov"),
              materialId: material.id,
              type: "entrada" as const,
              quantity: data.available,
              balanceAfter: data.available,
              reason: "Estoque inicial do cadastro",
              actor: s.user.name,
              timestamp: new Date().toISOString(),
              idempotencyKey: `cadastro-${material.id}`,
            },
            ...s.movements,
          ]
        : s.movements,
    history: [
      createHistoryEntry({
        kind: "cadastro",
        materialCode: material.code,
        actor: s.user.name,
        action: "Material cadastrado",
        details: `${material.code} · ${material.name} (${material.category})`,
      }),
      ...s.history,
    ],
  }));

  return material;
}

/**
 * Edita os dados cadastrais. O saldo (available) NÃO é alterado aqui:
 * quantidades só mudam por movimentação rastreável.
 */
export async function updateMaterial(id: string, input: MaterialInput): Promise<Material> {
  await simulateLatency();
  requirePermission("material.edit");
  const data = parseMaterialInput(input);
  const state = getDemoState();
  const current = findMaterial(state, id);
  assertUniqueCode(data.code, state, id);

  pushUndoSnapshot(`Edição de ${current.code}`);
  const updated: Material = {
    ...current,
    code: data.code.toUpperCase(),
    name: data.name,
    description: data.description,
    category: data.category,
    unit: data.unit,
    location: data.location,
    minimumStock: data.minimumStock,
    supplier: data.supplier,
    cost: data.cost,
    active: data.active,
  };

  setDemoState((s) => ({
    ...s,
    materials: s.materials.map((m) => (m.id === id ? updated : m)),
    history: [
      createHistoryEntry({
        kind: "cadastro",
        materialCode: updated.code,
        actor: s.user.name,
        action: "Cadastro de material atualizado",
        details: `${updated.code} · ${updated.name}`,
      }),
      ...s.history,
    ],
  }));

  return updated;
}

/** Desativa (ou reativa) um item sem apagar o histórico. */
export async function setMaterialActive(id: string, active: boolean, reason?: string): Promise<Material> {
  await simulateLatency();
  requirePermission("material.deactivate");
  const state = getDemoState();
  const current = findMaterial(state, id);
  if (current.active === active) return current;

  if (!active) {
    const inUse = state.requests.some(
      (r) => r.status !== "Concluída" && r.status !== "Cancelada" && r.items.some((i) => i.materialId === id),
    );
    if (inUse) {
      throw new BusinessRuleError(
        "Este material está em solicitações em aberto e não pode ser desativado agora. Conclua ou cancele as solicitações primeiro.",
      );
    }
  }

  pushUndoSnapshot(`${active ? "Reativação" : "Desativação"} de ${current.code}`);
  const updated = { ...current, active };
  setDemoState((s) => ({
    ...s,
    materials: s.materials.map((m) => (m.id === id ? updated : m)),
    history: [
      createHistoryEntry({
        kind: "cadastro",
        materialCode: updated.code,
        actor: s.user.name,
        action: active ? "Material reativado" : "Material desativado",
        details: reason ? `Motivo: ${reason}` : undefined,
      }),
      ...s.history,
    ],
  }));
  return updated;
}

/* --------------------------- Movimentações -------------------------- */

/** Registra entrada, saída ou ajuste. Idempotente pela chave da operação. */
export async function registerMovement(input: MovementInput): Promise<{ movement: StockMovement; duplicate: boolean }> {
  await simulateLatency();
  requirePermission("stock.move");
  const parsed = movementInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BusinessRuleError(parsed.error.issues[0]?.message ?? "Movimentação inválida.");
  }
  const data = parsed.data;
  const state = getDemoState();
  const material = findMaterial(state, data.materialId);
  if (!material.active) {
    throw new BusinessRuleError("Este material está desativado. Reative o cadastro para movimentar.");
  }

  if (!consumeIdempotencyKey(data.idempotencyKey)) {
    const existing = getDemoState().movements.find((m) => m.idempotencyKey === data.idempotencyKey);
    if (existing) return { movement: existing, duplicate: true };
    throw new BusinessRuleError("Esta movimentação já foi registrada (operação duplicada ignorada).");
  }

  const balanceAfter = applyMovementBalance(material.available, data.type, data.quantity);
  pushUndoSnapshot(`Movimentação em ${material.code}`);

  const movement: StockMovement = {
    id: createId("mov"),
    materialId: material.id,
    type: data.type,
    quantity: data.quantity,
    balanceAfter,
    reason: data.reason.trim(),
    actor: state.user.name,
    timestamp: new Date().toISOString(),
    relatedRequestCode: data.relatedRequestCode?.trim() || undefined,
    idempotencyKey: data.idempotencyKey,
  };

  const actionLabel =
    data.type === "entrada" ? "Entrada de material registrada" : data.type === "saida" ? "Saída de material registrada" : "Ajuste de estoque registrado";
  const sign = data.type === "saida" ? "-" : "+";

  setDemoState((s) => ({
    ...s,
    materials: s.materials.map((m) => (m.id === material.id ? { ...m, available: balanceAfter } : m)),
    movements: [movement, ...s.movements],
    history: [
      createHistoryEntry({
        kind: "movimentacao",
        materialCode: material.code,
        requestCode: movement.relatedRequestCode,
        actor: s.user.name,
        action: actionLabel,
        details: `${sign}${data.quantity} ${material.unit} de ${material.name} — ${movement.reason}. Saldo: ${balanceAfter} ${material.unit}.`,
      }),
      ...s.history,
    ],
  }));

  return { movement, duplicate: false };
}

/** Compatibilidade: registra entrada (usado em fluxos existentes). */
export async function registerStockEntry(materialId: string, quantity: number, note?: string): Promise<void> {
  await registerMovement({
    materialId,
    type: "entrada",
    quantity,
    reason: note?.trim() || "Entrada registrada",
    idempotencyKey: `entry-${materialId}-${Date.now().toString(36)}`,
  });
}

/**
 * Estorna uma movimentação com compensação rastreável (nunca apaga o original).
 * Exige saldo suficiente quando o estorno for uma saída.
 */
export async function reverseMovement(id: string, reason: string, idempotencyKey: string): Promise<StockMovement> {
  await simulateLatency();
  requirePermission("stock.reverse");
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new BusinessRuleError("Informe o motivo do estorno (mínimo 5 caracteres).");
  }
  const state = getDemoState();
  const original = state.movements.find((m) => m.id === id);
  if (!original) throw new NotFoundError("Movimentação não encontrada.");
  if (original.type === "estorno") {
    throw new BusinessRuleError("Um estorno não pode ser estornado. Registre uma nova movimentação.");
  }
  const alreadyReversed = state.movements.some((m) => m.reversalOf === id);
  if (alreadyReversed) {
    throw new BusinessRuleError("Esta movimentação já foi estornada.");
  }
  const material = findMaterial(state, original.materialId);

  if (!consumeIdempotencyKey(idempotencyKey)) {
    const existing = getDemoState().movements.find((m) => m.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    throw new BusinessRuleError("Este estorno já foi registrado (operação duplicada ignorada).");
  }

  // Compensação: entrada vira saída e vice-versa; ajuste (que somou) vira saída.
  const reverseType: "entrada" | "saida" = original.type === "saida" ? "entrada" : "saida";
  const balanceAfter = applyMovementBalance(material.available, reverseType, original.quantity);
  pushUndoSnapshot(`Estorno em ${material.code}`);

  const reversal: StockMovement = {
    id: createId("mov"),
    materialId: material.id,
    type: "estorno",
    quantity: original.quantity,
    balanceAfter,
    reason: `Estorno de ${original.id}: ${cleanReason}`,
    actor: state.user.name,
    timestamp: new Date().toISOString(),
    relatedRequestCode: original.relatedRequestCode,
    reversalOf: original.id,
    idempotencyKey,
  };

  setDemoState((s) => ({
    ...s,
    materials: s.materials.map((m) => (m.id === material.id ? { ...m, available: balanceAfter } : m)),
    movements: [reversal, ...s.movements],
    history: [
      createHistoryEntry({
        kind: "movimentacao",
        materialCode: material.code,
        actor: s.user.name,
        action: "Estorno de movimentação",
        details: `Anulada a movimentação ${original.id} (${original.quantity} ${material.unit}). Saldo: ${balanceAfter} ${material.unit}. Motivo: ${cleanReason}.`,
      }),
      ...s.history,
    ],
  }));

  return reversal;
}

/** Sugere o próximo código livre (para o formulário de cadastro). */
export async function suggestMaterialCode(): Promise<string> {
  await simulateLatency(60);
  return nextMaterialCode(getDemoState().materials);
}
