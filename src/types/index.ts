/* ------------------------------------------------------------------ */
/* Domínio da Plataforma Maré — fábrica de produtos para cães.        */
/* Fonte oficial futura: Supabase (ver services/supabase +           */
/* supabase/schema.sql). Até a configuração, os serviços usam o       */
/* armazenamento local versionado (services/demo/demoDb).             */
/* ------------------------------------------------------------------ */

export const REQUEST_STATUSES = [
  "Pendente",
  "Em análise",
  "Aguardando materiais",
  "Em separação",
  "Pronta para disponibilização",
  "Concluída",
  "Cancelada",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Status que encerram o ciclo (sem transições de saída). */
export const TERMINAL_STATUSES: RequestStatus[] = ["Concluída", "Cancelada"];

export const PRIORITIES = ["Alta", "Média", "Baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Setores da fábrica de produtos para cães. */
export const SECTORS = [
  "Corte e Costura",
  "Montagem de Coleiras e Guias",
  "Enchimento de Camas",
  "Acabamento",
  "Embalagem",
  "Manutenção",
  "Planejamento (PCP)",
] as const;
export type Sector = (typeof SECTORS)[number];

/** Classificação oficial dos itens de estoque (sem misturar tipos). */
export const STOCK_CATEGORIES = [
  "Matéria-prima",
  "Componentes",
  "Produtos em processo",
  "Produtos acabados",
  "Embalagens",
  "Materiais auxiliares",
] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export const STOCK_UNITS = ["un", "pç", "m", "kg", "L", "cx", "par", "rolo"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export type StockStatus = "Normal" | "Baixo" | "Insuficiente" | "Indisponível";

/** Tons semânticos usados em badges, barras de progresso e gráficos. */
export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "primary" | "accent";

export interface Material {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Classificação oficial — ver STOCK_CATEGORIES. */
  category: string;
  /** Quantidade física disponível no almoxarifado. */
  available: number;
  unit: string;
  location: string;
  minimumStock: number;
  supplier?: string;
  /** Custo unitário em R$ (opcional). */
  cost?: number;
  /** Itens inativos preservam o histórico e saem das seleções. */
  active: boolean;
}

export interface MaterialInput {
  name: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  available: number;
  minimumStock: number;
  location: string;
  supplier?: string;
  cost?: number;
  active: boolean;
}

export type StockMovementType = "entrada" | "saida" | "ajuste" | "estorno";

export interface StockMovement {
  id: string;
  materialId: string;
  type: StockMovementType;
  /** Quantidade movimentada (sempre positiva; o sinal deriva do tipo). */
  quantity: number;
  /** Saldo do material imediatamente após a movimentação. */
  balanceAfter: number;
  reason: string;
  actor: string;
  /** ISO 8601 */
  timestamp: string;
  relatedRequestCode?: string;
  /** Movimentação anulada por esta (quando type === "estorno"). */
  reversalOf?: string;
  /** Chave de idempotência — impede duplicação por clique duplo/falha. */
  idempotencyKey: string;
}

export interface MovementInput {
  materialId: string;
  type: Exclude<StockMovementType, "estorno">;
  quantity: number;
  reason: string;
  relatedRequestCode?: string;
  idempotencyKey: string;
}

export interface RequestItem {
  materialId: string;
  requested: number;
  separated: number;
}

export interface ProductionRequest {
  id: string;
  code: string;
  description: string;
  sector: Sector;
  responsible: string;
  priority: Priority;
  status: RequestStatus;
  /** ISO 8601 */
  createdAt: string;
  /** Data no formato AAAA-MM-DD */
  dueDate: string;
  /** ISO 8601, preenchido quando a solicitação é concluída. */
  concludedAt?: string;
  updatedAt: string;
  items: RequestItem[];
  notes?: string;
  /** Auditoria: quem criou / atualizou por último. */
  createdBy: string;
  updatedBy: string;
  /** Cancelamento rastreável (obrigatório informar o motivo). */
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface RequestInput {
  description: string;
  sector: Sector;
  responsible: string;
  priority: Priority;
  dueDate: string;
  notes?: string;
  items: { materialId: string; requested: number }[];
}

export type HistoryKind =
  | "criacao"
  | "edicao"
  | "status"
  | "separacao"
  | "estoque"
  | "sistema"
  | "cancelamento"
  | "movimentacao"
  | "cadastro";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  kind: HistoryKind;
  requestCode?: string;
  materialCode?: string;
  actor: string;
  action: string;
  from?: string;
  to?: string;
  details?: string;
}

export type NotificationCategory = "prazo" | "atrasada" | "estoque" | "nova" | "separacao" | "cancelamento";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link: string;
}

/* --------------------------- Perfis e permissões -------------------- */

export type UserRole = "admin" | "pcp" | "almoxarifado" | "producao" | "leitura";

export type PermissionAction =
  | "material.create"
  | "material.edit"
  | "material.deactivate"
  | "stock.move"
  | "stock.reverse"
  | "request.create"
  | "request.edit"
  | "request.cancel"
  | "request.status"
  | "separation.execute";

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  roleKey: UserRole;
  sector: string;
  email: string;
  registration: string;
}

/* ------------------------------ Mar.IA ------------------------------ */

export type ChatMessageStatus = "done" | "streaming" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status: ChatMessageStatus;
  errorCode?: string;
  errorMessage?: string;
  mode?: "demo" | "ai";
  /** Avaliação da resposta: positiva ou negativa (somente respostas da IA). */
  feedback?: "up" | "down";
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
