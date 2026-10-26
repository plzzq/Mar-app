/* ------------------------------------------------------------------ */
/* DADOS DE DEMONSTRAÇÃO — fábrica de produtos para cães (fictícios). */
/* As datas são geradas em relação a hoje, para que prazos, atrasos   */
/* e alertas permaneçam coerentes em qualquer dia de uso.             */
/* Nenhum registro aqui é operacional: a fonte oficial será o         */
/* Supabase (ver supabase/schema.sql).                                */
/* ------------------------------------------------------------------ */
import type {
  AppNotification,
  ChatConversation,
  HistoryEntry,
  HistoryKind,
  Material,
  Priority,
  ProductionRequest,
  RequestStatus,
  Sector,
  StockMovement,
  UserProfile,
} from "@/types";
import { dateOffset, isoOffset } from "@/lib/utils";

export const DEMO_USERS: UserProfile[] = [
  { id: "user-ana-ribeiro", name: "Ana Paula Ribeiro", role: "Administradora do sistema", roleKey: "admin", sector: "Planejamento e Controle da Produção", email: "ana.ribeiro@exemplo.com.br", registration: "ADM-0001" },
  { id: "user-rafael-teixeira", name: "Rafael Teixeira", role: "Analista de PCP", roleKey: "pcp", sector: "Planejamento e Controle da Produção", email: "rafael.teixeira@exemplo.com.br", registration: "PCP-0142" },
  { id: "user-lucas-martins", name: "Lucas Martins", role: "Almoxarife", roleKey: "almoxarifado", sector: "Almoxarifado", email: "lucas.martins@exemplo.com.br", registration: "ALM-0207" },
  { id: "user-fernanda-lima", name: "Fernanda Lima", role: "Líder de Produção", roleKey: "producao", sector: "Montagem de Coleiras e Guias", email: "fernanda.lima@exemplo.com.br", registration: "PRD-0331" },
];

export const DEMO_USER: UserProfile = DEMO_USERS[0];

export const DEMO_MATERIALS: Material[] = [
  { id: "mat-2001", code: "MAT-2001", name: "Fita de poliéster 25 mm – rolo 50 m", description: "Fita para coleiras e guias, cores sortidas.", category: "Matéria-prima", available: 420, unit: "m", location: "A-01-01", minimumStock: 100, supplier: "Tecidos Ipiranga", cost: 3.4, active: true },
  { id: "mat-2002", code: "MAT-2002", name: "Fivela plástica 25 mm preta", description: "Fecho de engate rápido para coleiras.", category: "Componentes", available: 1800, unit: "pç", location: "B-01-02", minimumStock: 400, supplier: "Plásticos Vale", cost: 0.85, active: true },
  { id: "mat-2003", code: "MAT-2003", name: "Argola soldada 25 mm niquelada", description: "Argola metálica para guia e plaquinha.", category: "Componentes", available: 950, unit: "pç", location: "B-01-03", minimumStock: 200, supplier: "Metalúrgica União", cost: 0.62, active: true },
  { id: "mat-2004", code: "MAT-2004", name: "Mosquetão giratório 360°", description: "Mosquetão para guias, trava de segurança.", category: "Componentes", available: 0, unit: "pç", location: "B-01-04", minimumStock: 120, supplier: "Metalúrgica União", cost: 4.9, active: true },
  { id: "mat-2005", code: "MAT-2005", name: "Linha de costura bonded nº 40", description: "Cone 5.000 m para costura reforçada.", category: "Materiais auxiliares", available: 60, unit: "un", location: "B-02-01", minimumStock: 12, supplier: "Linhas Sul", cost: 18.5, active: true },
  { id: "mat-2006", code: "MAT-2006", name: "Velcro adesivo 20 mm", description: "Fechamento para roupas e peitorais.", category: "Materiais auxiliares", available: 20, unit: "m", location: "B-02-02", minimumStock: 40, supplier: "Aviamentos Centro", cost: 2.1, active: true },
  { id: "mat-2007", code: "MAT-2007", name: "Etiqueta bordada Maré P", description: "Etiqueta aplicada em coleiras, guias e camas.", category: "Componentes", available: 2500, unit: "pç", location: "B-02-03", minimumStock: 500, supplier: "Bordados Leste", cost: 0.35, active: true },
  { id: "mat-2008", code: "MAT-2008", name: "Espuma D33 para camas", description: "Placa 100 x 60 x 8 cm.", category: "Matéria-prima", available: 85, unit: "un", location: "A-02-01", minimumStock: 20, supplier: "Espumas Conforto", cost: 32.0, active: true },
  { id: "mat-2009", code: "MAT-2009", name: "Tecido Oxford 600D estampado", description: "Capa de camas e roupas, rolo 100 m.", category: "Matéria-prima", available: 260, unit: "m", location: "A-02-02", minimumStock: 60, supplier: "Tecidos Ipiranga", cost: 14.9, active: true },
  { id: "mat-2010", code: "MAT-2010", name: "Fibra siliconada para enchimento", description: "Enchimento antialérgico de camas e brinquedos.", category: "Matéria-prima", available: 90, unit: "kg", location: "A-02-03", minimumStock: 25, supplier: "Fibras Planalto", cost: 21.0, active: true },
  { id: "mat-2011", code: "MAT-2011", name: "Caixa de papelão personalizada", description: "Embalagem de expedição dos kits.", category: "Embalagens", available: 1200, unit: "un", location: "C-01-01", minimumStock: 300, supplier: "Caixas Rápidas", cost: 2.8, active: true },
  { id: "mat-2012", code: "MAT-2012", name: "Saco plástico biodegradável", description: "Embalagem individual dos produtos.", category: "Embalagens", available: 3000, unit: "un", location: "C-01-02", minimumStock: 800, supplier: "Embalagens Verdes", cost: 0.22, active: true },
  { id: "mat-2013", code: "MAT-2013", name: "Cama para cães M – montada", description: "Produto acabado pronto para expedição.", category: "Produtos acabados", available: 45, unit: "un", location: "C-02-01", minimumStock: 15, active: true },
  { id: "mat-2014", code: "MAT-2014", name: "Coleira ajustável P – montada", description: "Produto acabado pronto para expedição.", category: "Produtos acabados", available: 120, unit: "un", location: "C-02-02", minimumStock: 30, active: true },
  { id: "mat-2015", code: "MAT-2015", name: "Peitoral em Y – em processo", description: "Peças cortadas aguardando costura final.", category: "Produtos em processo", available: 35, unit: "un", location: "C-02-03", minimumStock: 10, active: true },
  { id: "mat-2016", code: "MAT-2016", name: "Guia retrátil antiga – descontinuada", description: "Modelo substituído pela guia de poliéster. Item inativo.", category: "Produtos acabados", available: 0, unit: "un", location: "C-02-04", minimumStock: 0, active: false },
];

/* ------------------------------ Solicitações ------------------------ */

interface RequestSeed {
  n: number;
  description: string;
  sector: Sector;
  responsible: string;
  createdBy: string;
  priority: Priority;
  status: RequestStatus;
  /** Dias em relação a hoje (negativo = passado). */
  created: number;
  due: number;
  concluded?: number;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAgo?: number;
  /** [código do material, quantidade solicitada, quantidade separada] */
  items: [string, number, number][];
  notes?: string;
}

function seedRequest(seed: RequestSeed): ProductionRequest {
  const id = String(seed.n).padStart(3, "0");
  const createdAt =
    seed.created === 0
      ? new Date(Date.now() - 90 * 60_000).toISOString()
      : isoOffset(seed.created, 8 + (seed.n % 4));
  const concludedAt = seed.concluded !== undefined ? isoOffset(seed.concluded, 16) : undefined;
  const cancelledAt = seed.cancelledAgo !== undefined ? isoOffset(seed.cancelledAgo, 15) : undefined;
  return {
    id: `req-${id}`,
    code: `SOL-2026-${id}`,
    description: seed.description,
    sector: seed.sector,
    responsible: seed.responsible,
    priority: seed.priority,
    status: seed.status,
    createdAt,
    dueDate: dateOffset(seed.due),
    concludedAt,
    updatedAt: cancelledAt ?? concludedAt ?? createdAt,
    items: seed.items.map(([code, requested, separated]) => ({
      materialId: `mat-${code}`,
      requested,
      separated,
    })),
    notes: seed.notes,
    createdBy: seed.createdBy,
    updatedBy: seed.cancelledBy ?? seed.createdBy,
    cancelReason: seed.cancelReason,
    cancelledAt,
    cancelledBy: seed.cancelledBy,
  };
}

const REQUEST_SEEDS: RequestSeed[] = [
  { n: 1, description: "Lote de coleiras ajustáveis P – 200 un", sector: "Montagem de Coleiras e Guias", responsible: "Fernanda Lima", createdBy: "Fernanda Lima", priority: "Alta", status: "Aguardando materiais", created: -6, due: -2, items: [["2001", 220, 0], ["2002", 200, 0], ["2003", 200, 0], ["2007", 200, 0]], notes: "Fita de poliéster abaixo do necessário para o lote." },
  { n: 2, description: "Lote de guias 1,2 m – 150 un", sector: "Montagem de Coleiras e Guias", responsible: "Fernanda Lima", createdBy: "Fernanda Lima", priority: "Alta", status: "Em separação", created: -4, due: 0, items: [["2001", 180, 120], ["2004", 150, 0], ["2007", 150, 150]] },
  { n: 3, description: "Lote de camas M – 60 un", sector: "Enchimento de Camas", responsible: "Paulo Henrique", createdBy: "Rafael Teixeira", priority: "Alta", status: "Pendente", created: -3, due: 1, items: [["2009", 130, 0], ["2008", 60, 0], ["2010", 45, 0], ["2007", 60, 0]] },
  { n: 4, description: "Lote de peitorais em Y – 120 un", sector: "Montagem de Coleiras e Guias", responsible: "Amanda Souza", createdBy: "Rafael Teixeira", priority: "Média", status: "Em separação", created: -5, due: 3, items: [["2001", 130, 80], ["2002", 120, 60], ["2003", 120, 120]] },
  { n: 5, description: "Kit passeio (coleira + guia) – 100 kits", sector: "Montagem de Coleiras e Guias", responsible: "Amanda Souza", createdBy: "Amanda Souza", priority: "Média", status: "Em análise", created: -8, due: -1, items: [["2001", 110, 0], ["2002", 100, 0], ["2004", 100, 0]] },
  { n: 6, description: "Lote de roupas de inverno – 80 un", sector: "Corte e Costura", responsible: "Camila Rocha", createdBy: "Camila Rocha", priority: "Alta", status: "Em separação", created: -2, due: -3, items: [["2009", 90, 40], ["2006", 60, 10]], notes: "Velcro abaixo do solicitado; verificar reposição." },
  { n: 7, description: "Reposição de brinquedos de corda – 150 un", sector: "Acabamento", responsible: "Paulo Henrique", createdBy: "Paulo Henrique", priority: "Baixa", status: "Pendente", created: -1, due: 10, items: [["2005", 8, 0], ["2012", 150, 0]] },
  { n: 8, description: "Kits embalados para expedição – 200 kits", sector: "Embalagem", responsible: "Juliana Rocha", createdBy: "Juliana Rocha", priority: "Média", status: "Pronta para disponibilização", created: -10, due: 5, items: [["2011", 200, 200], ["2012", 200, 200]] },
  { n: 9, description: "Lote de coleiras ajustáveis M – 150 un", sector: "Montagem de Coleiras e Guias", responsible: "Fernanda Lima", createdBy: "Fernanda Lima", priority: "Média", status: "Concluída", created: -12, due: -4, concluded: -3, items: [["2001", 150, 150], ["2002", 150, 150]] },
  { n: 10, description: "Lote de camas G – 40 un", sector: "Enchimento de Camas", responsible: "Paulo Henrique", createdBy: "Rafael Teixeira", priority: "Alta", status: "Concluída", created: -9, due: -2, concluded: -2, items: [["2009", 100, 100], ["2008", 40, 40], ["2010", 20, 20]] },
  { n: 11, description: "Reposição mensal de tecidos e fitas", sector: "Planejamento (PCP)", responsible: "Rafael Teixeira", createdBy: "Rafael Teixeira", priority: "Baixa", status: "Em análise", created: 0, due: 14, items: [["2009", 60, 0], ["2001", 100, 0], ["2006", 10, 0]] },
  { n: 12, description: "Acessórios de passeio – aguardando mosquetão", sector: "Montagem de Coleiras e Guias", responsible: "Fernanda Lima", createdBy: "Rafael Teixeira", priority: "Alta", status: "Aguardando materiais", created: -2, due: 2, items: [["2004", 80, 0], ["2001", 90, 0]], notes: "Mosquetão sem saldo; compra em andamento." },
  { n: 13, description: "Troca de etiquetas – lote coleiras G", sector: "Acabamento", responsible: "Juliana Rocha", createdBy: "Juliana Rocha", priority: "Média", status: "Pendente", created: -1, due: 6, items: [["2007", 300, 0], ["2005", 4, 0]] },
  { n: 14, description: "Lote de guias retráteis – 50 un", sector: "Montagem de Coleiras e Guias", responsible: "Fernanda Lima", createdBy: "Fernanda Lima", priority: "Média", status: "Cancelada", created: -7, due: 4, cancelledAgo: -5, cancelledBy: "Rafael Teixeira", cancelReason: "Produto descontinuado: a guia retrátil foi substituída pela guia de poliéster 1,2 m.", items: [["2001", 60, 0]] },
];

export const DEMO_REQUESTS: ProductionRequest[] = REQUEST_SEEDS.map(seedRequest);

/* ----------------------------- Movimentações ------------------------ */

export const DEMO_MOVEMENTS: StockMovement[] = [
  { id: "mov-001", materialId: "mat-2001", type: "entrada", quantity: 200, balanceAfter: 420, reason: "Compra programada – NF 10231", actor: "Lucas Martins (Almoxarifado)", timestamp: isoOffset(-9, 10), idempotencyKey: "seed-mov-001" },
  { id: "mov-002", materialId: "mat-2009", type: "entrada", quantity: 150, balanceAfter: 260, reason: "Compra programada – NF 10240", actor: "Lucas Martins (Almoxarifado)", timestamp: isoOffset(-8, 11), idempotencyKey: "seed-mov-002" },
  { id: "mov-003", materialId: "mat-2006", type: "saida", quantity: 30, balanceAfter: 20, reason: "Consumo no lote de roupas SOL-2026-006", actor: "Lucas Martins (Almoxarifado)", timestamp: isoOffset(-2, 14), relatedRequestCode: "SOL-2026-006", idempotencyKey: "seed-mov-003" },
  { id: "mov-004", materialId: "mat-2002", type: "ajuste", quantity: 50, balanceAfter: 1800, reason: "Ajuste de inventário: sobra de contagem cíclica", actor: "Ana Paula Ribeiro (PCP)", timestamp: isoOffset(-4, 9), idempotencyKey: "seed-mov-004" },
  { id: "mov-005", materialId: "mat-2004", type: "saida", quantity: 40, balanceAfter: 0, reason: "Consumo no lote de guias SOL-2026-002", actor: "Lucas Martins (Almoxarifado)", timestamp: isoOffset(-3, 10), relatedRequestCode: "SOL-2026-002", idempotencyKey: "seed-mov-005" },
];

/* ------------------------------ Histórico --------------------------- */

const ACTORS = {
  ana: "Ana Paula Ribeiro (Admin)",
  rafael: "Rafael Teixeira (PCP)",
  lucas: "Lucas Martins (Almoxarifado)",
  fernanda: "Fernanda Lima (Produção)",
  paulo: "Paulo Henrique (Produção)",
  juliana: "Juliana Rocha (Embalagem)",
  amanda: "Amanda Souza (Montagem)",
  camila: "Camila Rocha (Costura)",
  sistema: "Sistema (demonstração)",
} as const;

type HistorySeed = [kind: HistoryKind, n: number | null, day: number, hour: number, action: string, actor: string, from?: string, to?: string, details?: string, materialCode?: string];

const HISTORY_SEEDS: HistorySeed[] = [
  ["sistema", null, -12, 8, "Dados de demonstração carregados", ACTORS.sistema],
  ["criacao", 9, -12, 8, "Solicitação criada", ACTORS.fernanda, undefined, "Pendente"],
  ["status", 9, -10, 10, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["status", 9, -9, 11, "Mudança de status", ACTORS.lucas, "Em análise", "Em separação"],
  ["separacao", 9, -8, 15, "Separação concluída", ACTORS.lucas, undefined, undefined, "Materiais separados para o lote de coleiras"],
  ["status", 9, -7, 16, "Mudança de status", ACTORS.fernanda, "Em separação", "Pronta para disponibilização"],
  ["status", 9, -4, 9, "Mudança de status", ACTORS.fernanda, "Pronta para disponibilização", "Concluída", "Entregue com 1 dia de atraso"],
  ["criacao", 10, -9, 8, "Solicitação criada", ACTORS.rafael, undefined, "Pendente"],
  ["status", 10, -8, 10, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["status", 10, -6, 14, "Mudança de status", ACTORS.lucas, "Em análise", "Em separação"],
  ["status", 10, -2, 16, "Mudança de status", ACTORS.fernanda, "Em separação", "Concluída", "Entrega no prazo"],
  ["criacao", 1, -6, 8, "Solicitação criada", ACTORS.fernanda, undefined, "Pendente"],
  ["status", 1, -5, 14, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["estoque", 1, -4, 10, "Insuficiência de materiais informada", ACTORS.rafael, "Em análise", "Aguardando materiais", "Fita de poliéster 25 mm: demanda acima do disponível."],
  ["criacao", 2, -4, 8, "Solicitação criada", ACTORS.fernanda, undefined, "Pendente"],
  ["status", 2, -4, 11, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["status", 2, -3, 9, "Mudança de status", ACTORS.lucas, "Em análise", "Em separação"],
  ["separacao", 2, -2, 16, "Separação parcial registrada", ACTORS.lucas, undefined, undefined, "120 m de fita de poliéster 25 mm"],
  ["criacao", 3, -3, 9, "Solicitação criada", ACTORS.rafael, undefined, "Pendente"],
  ["criacao", 4, -5, 8, "Solicitação criada", ACTORS.amanda, undefined, "Pendente"],
  ["status", 4, -5, 10, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["status", 4, -4, 15, "Mudança de status", ACTORS.lucas, "Em análise", "Em separação"],
  ["criacao", 5, -8, 8, "Solicitação criada", ACTORS.amanda, undefined, "Pendente"],
  ["status", 5, -7, 10, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["criacao", 6, -2, 8, "Solicitação criada", ACTORS.camila, undefined, "Pendente"],
  ["status", 6, -2, 11, "Mudança de status", ACTORS.lucas, "Em análise", "Em separação"],
  ["estoque", 6, -1, 9, "Insuficiência de materiais informada", ACTORS.lucas, "Em separação", "Aguardando materiais", "Velcro 20 mm: necessário 60 m, disponível 20 m."],
  ["criacao", 7, -1, 9, "Solicitação criada", ACTORS.paulo, undefined, "Pendente"],
  ["criacao", 12, -2, 8, "Solicitação criada", ACTORS.rafael, undefined, "Pendente"],
  ["status", 12, -1, 10, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
  ["estoque", 12, -1, 11, "Insuficiência de materiais informada", ACTORS.rafael, "Em análise", "Aguardando materiais", "Mosquetão giratório: disponível 0 pç."],
  ["criacao", 13, -1, 14, "Solicitação criada", ACTORS.juliana, undefined, "Pendente"],
  ["criacao", 14, -7, 8, "Solicitação criada", ACTORS.fernanda, undefined, "Pendente"],
  ["cancelamento", 14, -5, 15, "Solicitação cancelada", ACTORS.rafael, "Em análise", "Cancelada", "Motivo: produto descontinuado: a guia retrátil foi substituída pela guia de poliéster 1,2 m."],
  ["cadastro", null, -9, 10, "Material cadastrado", ACTORS.lucas, undefined, undefined, "MAT-2001 · Fita de poliéster 25 mm – rolo 50 m", "MAT-2001"],
  ["movimentacao", null, -9, 10, "Entrada de material registrada", ACTORS.lucas, undefined, undefined, "+200 m de Fita de poliéster 25 mm (NF 10231)", "MAT-2001"],
  ["movimentacao", null, -2, 14, "Saída de material registrada", ACTORS.lucas, undefined, undefined, "-30 m de Velcro 20 mm (SOL-2026-006)", "MAT-2006"],
  ["criacao", 11, 0, 7, "Solicitação criada", ACTORS.rafael, undefined, "Pendente"],
  ["status", 11, 0, 7, "Mudança de status", ACTORS.rafael, "Pendente", "Em análise"],
];

export const DEMO_HISTORY: HistoryEntry[] = HISTORY_SEEDS.map(([kind, n, day, hour, action, actor, from, to, details, materialCode], index) => ({
  id: `hist-${String(index + 1).padStart(3, "0")}`,
  timestamp: isoOffset(day, hour),
  kind,
  requestCode: n === null ? undefined : `SOL-2026-${String(n).padStart(3, "0")}`,
  actor,
  action,
  from,
  to,
  details,
  materialCode,
}));

/* ----------------------------- Notificações ------------------------- */

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: "not-001", category: "atrasada", title: "Solicitação atrasada: SOL-2026-001", message: "Prazo vencido. Status atual: Aguardando materiais.", createdAt: isoOffset(-1, 8), read: false, link: "/solicitacoes/req-001" },
  { id: "not-002", category: "atrasada", title: "Solicitação atrasada: SOL-2026-006", message: "Prazo vencido com separação em andamento e saldo insuficiente.", createdAt: isoOffset(-1, 9), read: false, link: "/solicitacoes/req-006" },
  { id: "not-003", category: "prazo", title: "Prazo vence hoje: SOL-2026-002", message: "Lote de guias 1,2 m com separação em andamento.", createdAt: isoOffset(0, 7), read: false, link: "/solicitacoes/req-002" },
  { id: "not-004", category: "estoque", title: "Estoque insuficiente: MAT-2001", message: "Fita de poliéster 25 mm com demanda acima do disponível.", createdAt: isoOffset(-2, 10), read: false, link: "/estoque/mat-2001" },
  { id: "not-005", category: "estoque", title: "Material indisponível: MAT-2004", message: "Mosquetão giratório sem saldo físico.", createdAt: isoOffset(-2, 11), read: false, link: "/estoque/mat-2004" },
  { id: "not-006", category: "prazo", title: "Prazo próximo: SOL-2026-012", message: "Vence em 2 dias e aguarda materiais.", createdAt: isoOffset(0, 8), read: false, link: "/solicitacoes/req-012" },
  { id: "not-007", category: "nova", title: "Nova solicitação: SOL-2026-011", message: "Reposição mensal de tecidos e fitas.", createdAt: isoOffset(0, 7), read: true, link: "/solicitacoes/req-011" },
  { id: "not-008", category: "separacao", title: "Separação concluída: SOL-2026-008", message: "Kits embalados prontos para disponibilização.", createdAt: isoOffset(-3, 16), read: true, link: "/solicitacoes/req-008" },
  { id: "not-009", category: "prazo", title: "Prazo próximo: SOL-2026-003", message: "Lote de camas M vence amanhã.", createdAt: isoOffset(-1, 15), read: true, link: "/solicitacoes/req-003" },
  { id: "not-010", category: "cancelamento", title: "Solicitação cancelada: SOL-2026-014", message: "Produto descontinuado. Verifique o motivo registrado.", createdAt: isoOffset(-5, 15), read: true, link: "/solicitacoes/req-014" },
];

/* ------------------------------ Mar.IA ------------------------------ */

export const DEMO_CONVERSATIONS: ChatConversation[] = [
  {
    id: "conv-001",
    title: "Demandas atrasadas",
    createdAt: isoOffset(-1, 9),
    updatedAt: isoOffset(-1, 9),
    messages: [
      { id: "msg-001", role: "user", content: "Quais demandas estão atrasadas?", createdAt: isoOffset(-1, 9), status: "done" },
      {
        id: "msg-002",
        role: "assistant",
        content:
          "**Dado confirmado:** existem solicitações com prazo vencido e ainda não concluídas.\n\n- **SOL-2026-001** · Montagem de Coleiras e Guias · Fernanda Lima\n- **SOL-2026-005** · Montagem de Coleiras e Guias · Amanda Souza\n- **SOL-2026-006** · Corte e Costura · Camila Rocha\n\n**Recomendação:** priorize a SOL-2026-001 e a SOL-2026-006, que também possuem insuficiência de materiais.",
        createdAt: isoOffset(-1, 9),
        status: "done",
        mode: "demo",
      },
    ],
  },
  {
    id: "conv-002",
    title: "Estoque insuficiente",
    createdAt: isoOffset(-1, 15),
    updatedAt: isoOffset(-1, 15),
    messages: [
      { id: "msg-003", role: "user", content: "Quais materiais estão insuficientes?", createdAt: isoOffset(-1, 15), status: "done" },
      {
        id: "msg-004",
        role: "assistant",
        content:
          "**Dado confirmado:** há materiais cuja demanda comprometida supera o disponível físico.\n\n- **MAT-2001** Fita de poliéster 25 mm · disponível 420 m\n- **MAT-2006** Velcro 20 mm · disponível 20 m\n- **MAT-2004** Mosquetão giratório · sem saldo",
        createdAt: isoOffset(-1, 15),
        status: "done",
        mode: "demo",
      },
    ],
  },
];
