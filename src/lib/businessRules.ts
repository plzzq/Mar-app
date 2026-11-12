/* ------------------------------------------------------------------ */
/* Regras de negócio puras (sem React e sem acesso a dados).          */
/* Mantidas no cliente para validação antecipada e replicadas no      */
/* backend (Supabase: constraints + triggers — ver supabase/).        */
/* ------------------------------------------------------------------ */
import {
  REQUEST_STATUSES,
  TERMINAL_STATUSES,
  type Material,
  type Priority,
  type ProductionRequest,
  type RequestItem,
  type RequestStatus,
  type StockStatus,
  type Tone,
} from "@/types";
import { BusinessRuleError } from "./errors";
import { diffInDays } from "./utils";

/* ----------------------------- Status -------------------------------- */

export const STATUS_META: Record<RequestStatus, { tone: Tone; description: string }> = {
  Pendente: { tone: "neutral", description: "Aguardando triagem do PCP." },
  "Em análise": { tone: "info", description: "PCP verificando a demanda e a disponibilidade de materiais." },
  "Aguardando materiais": { tone: "warning", description: "Dependente de reposição ou liberação de material." },
  "Em separação": { tone: "primary", description: "Almoxarifado separando os itens solicitados." },
  "Pronta para disponibilização": { tone: "accent", description: "Itens separados, aguardando retirada pela produção." },
  Concluída: { tone: "success", description: "Materiais entregues à produção." },
  Cancelada: { tone: "neutral", description: "Solicitação cancelada com motivo registrado. Preservada para histórico." },
};

/**
 * Fluxo de transições permitido. Para adaptar o processo, altere apenas este mapa:
 * a interface e os serviços leem as transições daqui.
 * O cancelamento usa fluxo próprio (cancelRequest, com motivo obrigatório).
 */
export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Pendente: ["Em análise"],
  "Em análise": ["Aguardando materiais", "Em separação", "Pendente"],
  "Aguardando materiais": ["Em análise", "Em separação"],
  "Em separação": ["Aguardando materiais", "Pronta para disponibilização"],
  "Pronta para disponibilização": ["Em separação", "Concluída"],
  Concluída: [],
  Cancelada: [],
};

/** Transições que pedem confirmação explícita do usuário. */
export const TRANSITIONS_REQUIRING_CONFIRMATION: RequestStatus[] = ["Aguardando materiais", "Concluída"];

export const OPEN_STATUSES: RequestStatus[] = ["Pendente", "Em análise", "Aguardando materiais"];
export const ACTIVE_STATUSES: RequestStatus[] = REQUEST_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));
export const SEPARATION_STATUS: RequestStatus = "Em separação";

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function assertCanTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(`Não é possível mudar o status de "${from}" para "${to}".`);
  }
}

/** Cancelamento permitido em qualquer etapa não terminal. */
export function canCancel(status: RequestStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export function assertCanCancel(status: RequestStatus): void {
  if (!canCancel(status)) {
    throw new BusinessRuleError(
      status === "Cancelada" ? "Esta solicitação já está cancelada." : "Solicitações concluídas não podem ser canceladas.",
    );
  }
}

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Edição de dados permitida fora dos status terminais. */
export function canEditRequest(status: RequestStatus): boolean {
  return !isTerminal(status);
}

/* ----------------------------- Prioridade ---------------------------- */

export const PRIORITY_META: Record<Priority, { tone: Tone; weight: number }> = {
  Alta: { tone: "danger", weight: 3 },
  Média: { tone: "warning", weight: 2 },
  Baixa: { tone: "neutral", weight: 1 },
};

/* ------------------------------ Prazos ------------------------------- */

export const NEAR_DEADLINE_DAYS = 2;

export type DeadlineState = "concluida" | "cancelada" | "atrasada" | "hoje" | "proxima" | "no-prazo";

export interface DeadlineInfo {
  state: DeadlineState;
  /** Dias até o prazo (negativo = atraso). */
  days: number;
}

export const DEADLINE_META: Record<DeadlineState, { label: string; tone: Tone }> = {
  concluida: { label: "Concluída", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
  atrasada: { label: "Atrasada", tone: "danger" },
  hoje: { label: "Vence hoje", tone: "warning" },
  proxima: { label: "Prazo próximo", tone: "warning" },
  "no-prazo": { label: "No prazo", tone: "neutral" },
};

export function getDeadline(request: ProductionRequest): DeadlineInfo {
  const days = diffInDays(request.dueDate);
  if (request.status === "Concluída") return { state: "concluida", days };
  if (request.status === "Cancelada") return { state: "cancelada", days };
  if (days < 0) return { state: "atrasada", days };
  if (days === 0) return { state: "hoje", days };
  if (days <= NEAR_DEADLINE_DAYS) return { state: "proxima", days };
  return { state: "no-prazo", days };
}

/* ----------------------------- Estoque ------------------------------- */

export const STOCK_STATUS_META: Record<StockStatus, { tone: Tone; severity: number; description: string }> = {
  Normal: { tone: "success", severity: 0, description: "Saldo projetado acima do estoque mínimo." },
  Baixo: { tone: "warning", severity: 1, description: "Saldo projetado igual ou abaixo do estoque mínimo." },
  Insuficiente: { tone: "danger", severity: 2, description: "Demanda comprometida maior que a quantidade disponível." },
  Indisponível: { tone: "danger", severity: 3, description: "Sem quantidade física disponível." },
};

export interface MaterialMetrics {
  available: number;
  /** Quantidade pendente comprometida com solicitações em separação. */
  reserved: number;
  /** Quantidade pendente de solicitações ainda não liberadas para separação. */
  openDemand: number;
  /** Disponível menos reservado. */
  freeBalance: number;
  /** Disponível menos reservado e demanda em aberto. */
  projected: number;
  /** Quantidade que excede o disponível físico. */
  shortfall: number;
  status: StockStatus;
}

export function getPendingQty(item: RequestItem): number {
  return Math.max(0, item.requested - item.separated);
}

export function getItemProgress(item: RequestItem): number {
  if (item.requested <= 0) return 100;
  return Math.min(100, Math.round((item.separated / item.requested) * 100));
}

export function computeMaterialMetrics(material: Material, requests: ProductionRequest[]): MaterialMetrics {
  let reserved = 0;
  let openDemand = 0;

  for (const request of requests) {
    // Solicitações canceladas liberam automaticamente as reservas.
    if (isTerminal(request.status)) continue;
    for (const item of request.items) {
      if (item.materialId !== material.id) continue;
      const pending = getPendingQty(item);
      if (request.status === SEPARATION_STATUS) reserved += pending;
      else if (OPEN_STATUSES.includes(request.status)) openDemand += pending;
    }
  }

  const available = material.available;
  const projected = available - reserved - openDemand;
  const shortfall = Math.max(0, reserved + openDemand - available);

  let status: StockStatus = "Normal";
  if (available <= 0) status = "Indisponível";
  else if (shortfall > 0) status = "Insuficiente";
  else if (projected <= material.minimumStock) status = "Baixo";

  return {
    available,
    reserved,
    openDemand,
    freeBalance: Math.max(0, available - reserved),
    projected,
    shortfall,
    status,
  };
}

export function buildMaterialMetricsMap(
  materials: Material[],
  requests: ProductionRequest[],
): Record<string, MaterialMetrics> {
  return Object.fromEntries(materials.map((m) => [m.id, computeMaterialMetrics(m, requests)]));
}

/* ---------------------- Movimentações de estoque --------------------- */

export const MOVEMENT_META = {
  entrada: { label: "Entrada", tone: "success" as Tone },
  saida: { label: "Saída", tone: "info" as Tone },
  ajuste: { label: "Ajuste", tone: "warning" as Tone },
  estorno: { label: "Estorno", tone: "neutral" as Tone },
} as const;

/** Valida quantidade e saldo para uma movimentação. Retorna o novo saldo. */
export function applyMovementBalance(
  currentBalance: number,
  type: "entrada" | "saida" | "ajuste",
  quantity: number,
): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BusinessRuleError("Informe uma quantidade inteira maior que zero.");
  }
  if (type === "entrada" || type === "ajuste") return currentBalance + quantity;
  if (quantity > currentBalance) {
    throw new BusinessRuleError(
      `Saída de ${quantity} excede o saldo disponível (${currentBalance}).`,
    );
  }
  return currentBalance - quantity;
}

/* --------------------------- Análise por item ------------------------ */

export interface ItemAnalysis {
  item: RequestItem;
  material?: Material;
  pending: number;
  /** Quantidade livre para esta solicitação (desconsidera a própria reserva). */
  available: number;
  /** Positivo = faltam materiais. */
  difference: number;
  isShortage: boolean;
  progress: number;
}

export type AttentionLevel = "critico" | "alto" | "medio" | "baixo";

export const ATTENTION_META: Record<AttentionLevel, { label: string; tone: Tone }> = {
  critico: { label: "Crítico", tone: "danger" },
  alto: { label: "Alto", tone: "warning" },
  medio: { label: "Médio", tone: "info" },
  baixo: { label: "Baixo", tone: "neutral" },
};

export interface RequestAnalysis {
  request: ProductionRequest;
  items: ItemAnalysis[];
  requested: number;
  separated: number;
  pending: number;
  progress: number;
  deadline: DeadlineInfo;
  shortages: ItemAnalysis[];
  attentionScore: number;
  attention: AttentionLevel;
}

function getAvailableForRequest(
  request: ProductionRequest,
  item: RequestItem,
  metrics: MaterialMetrics | undefined,
): number {
  if (!metrics) return 0;
  const ownReserved = request.status === SEPARATION_STATUS ? getPendingQty(item) : 0;
  const reservedByOthers = Math.max(0, metrics.reserved - ownReserved);
  return Math.max(0, metrics.available - reservedByOthers);
}

export function analyzeRequest(
  request: ProductionRequest,
  materialsById: Record<string, Material>,
  metrics: Record<string, MaterialMetrics>,
): RequestAnalysis {
  const items: ItemAnalysis[] = request.items.map((item) => {
    const pending = getPendingQty(item);
    const available = getAvailableForRequest(request, item, metrics[item.materialId]);
    const difference = pending - available;
    return {
      item,
      material: materialsById[item.materialId],
      pending,
      available,
      difference,
      isShortage: pending > 0 && difference > 0,
      progress: getItemProgress(item),
    };
  });

  const requested = items.reduce((sum, i) => sum + i.item.requested, 0);
  const separated = items.reduce((sum, i) => sum + i.item.separated, 0);
  const pending = items.reduce((sum, i) => sum + i.pending, 0);
  const shortages = items.filter((i) => i.isShortage);
  const deadline = getDeadline(request);

  let score = 0;
  if (!isTerminal(request.status)) {
    if (deadline.state === "atrasada") score += 4;
    else if (deadline.state === "hoje") score += 3;
    else if (deadline.state === "proxima") score += 2;
    score += request.priority === "Alta" ? 3 : request.priority === "Média" ? 1 : 0;
    score += Math.min(4, shortages.length * 2);
    if (request.status === "Aguardando materiais") score += 1;
  }

  const attention: AttentionLevel =
    score >= 7 ? "critico" : score >= 4 ? "alto" : score >= 2 ? "medio" : "baixo";

  return {
    request,
    items,
    requested,
    separated,
    pending,
    progress: requested === 0 ? 0 : Math.round((separated / requested) * 100),
    deadline,
    shortages,
    attentionScore: score,
    attention,
  };
}

/** Calcula a análise de todas as solicitações a partir dos dados atuais. */
export function analyzeAll(requests: ProductionRequest[], materials: Material[]): RequestAnalysis[] {
  const metrics = buildMaterialMetricsMap(materials, requests);
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]));
  return requests.map((r) => analyzeRequest(r, byId, metrics));
}

/* ------------------------- Regras de separação ----------------------- */

/** Motivos que impedem o início da separação (lista vazia = pode iniciar). */
export function getSeparationBlockers(analysis: RequestAnalysis): string[] {
  const blockers: string[] = [];
  if (!["Em análise", "Aguardando materiais"].includes(analysis.request.status)) {
    blockers.push("A solicitação não está em uma etapa que permita iniciar a separação.");
  }
  for (const item of analysis.items) {
    if (item.pending > 0 && item.material && !item.material.active) {
      blockers.push(`${item.material.name}: item desativado no estoque.`);
    }
  }
  for (const shortage of analysis.shortages) {
    blockers.push(
      `${shortage.material?.name ?? "Material"}: faltam ${shortage.difference} ${shortage.material?.unit ?? "un"}.`,
    );
  }
  return blockers;
}

export function isSeparationComplete(request: ProductionRequest): boolean {
  return request.items.length > 0 && request.items.every((item) => getPendingQty(item) === 0);
}

/** Ordena para a fila de separação: prioridade, depois prazo e data de criação. */
export function compareForSeparation(a: RequestAnalysis, b: RequestAnalysis): number {
  const byPriority = PRIORITY_META[b.request.priority].weight - PRIORITY_META[a.request.priority].weight;
  if (byPriority !== 0) return byPriority;
  const byDue = a.request.dueDate.localeCompare(b.request.dueDate);
  if (byDue !== 0) return byDue;
  return a.request.createdAt.localeCompare(b.request.createdAt);
}
