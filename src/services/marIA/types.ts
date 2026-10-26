/* ------------------------------------------------------------------ */
/* Contrato da camada da Mar.IA.                                      */
/* A interface é independente do modelo: o provedor de demonstração   */
/* e um futuro provedor remoto implementam o mesmo MarIAProvider.     */
/* ------------------------------------------------------------------ */
import type { ChatMessage, Priority, RequestStatus, StockStatus } from "@/types";
import type { AttentionLevel, DeadlineState } from "@/lib/businessRules";

export type MarIAErrorCode = "not_configured" | "rate_limit" | "network" | "unavailable" | "aborted" | "unknown";

export class MarIAError extends Error {
  readonly code: MarIAErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(code: MarIAErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "MarIAError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/* ------------------- Contexto operacional estruturado ---------------- */
/* Enviado à Mar.IA (no futuro, gerado pelo backend com autorização).   */
/* A IA deve usar estes dados para confirmar fatos, não para inventá-los. */

export interface OperationalContextRequest {
  code: string;
  description: string;
  sector: string;
  responsible: string;
  priority: Priority;
  status: RequestStatus;
  createdAt: string;
  dueDate: string;
  concludedAt?: string;
  deadlineState: DeadlineState;
  daysToDue: number;
  progressPercent: number;
  attentionLevel: AttentionLevel;
  requestedTotal: number;
  separatedTotal: number;
  pendingItems: {
    materialCode: string;
    materialName: string;
    unit: string;
    pending: number;
    available: number;
    difference: number;
  }[];
}

export interface OperationalContextMaterial {
  code: string;
  name: string;
  unit: string;
  location: string;
  minimumStock: number;
  available: number;
  reserved: number;
  openDemand: number;
  freeBalance: number;
  projected: number;
  shortfall: number;
  status: StockStatus;
}

export interface OperationalContextSummary {
  totalRequests: number;
  openRequests: number;
  inSeparation: number;
  readyForDelivery: number;
  completed: number;
  overdueRequests: number;
  nearDeadlineRequests: number;
  insufficientRequests: number;
  insufficientMaterials: number;
  unavailableMaterials: number;
  lowStockMaterials: number;
}

export interface OperationalContext {
  generatedAt: string;
  /** Origem dos dados: nesta fase, sempre dados de demonstração. */
  source: string;
  requests: OperationalContextRequest[];
  materials: OperationalContextMaterial[];
  summary: OperationalContextSummary;
}

/* ------------------------------ Requisição -------------------------- */

export interface MarIAInput {
  conversationId: string;
  message: string;
  history: ChatMessage[];
  signal?: AbortSignal;
}

export interface MarIARequest extends MarIAInput {
  context: OperationalContext;
}

export interface MarIAResponse {
  content: string;
  mode: "demo" | "ai";
}

export interface MarIAProvider {
  readonly mode: "demo" | "ai";
  readonly name: string;
  /** Responde à pergunta. Se onChunk for informado, envia o texto em fluxo contínuo. */
  respond(request: MarIARequest, onChunk?: (chunk: string) => void): Promise<MarIAResponse>;
}
