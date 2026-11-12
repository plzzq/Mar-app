/* Badges semânticos do domínio: sempre combinam cor, ícone e texto (não dependem só da cor). */
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ChevronsDown,
  ChevronsUp,
  CircleCheck,
  CircleDashed,
  Clock,
  Equal,
  FileText,
  Hourglass,
  PackageCheck,
  PackageOpen,
  PackageX,
  Plus,
  Search,
  TrendingDown,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import {
  ATTENTION_META,
  DEADLINE_META,
  MOVEMENT_META,
  PRIORITY_META,
  STATUS_META,
  STOCK_STATUS_META,
  type AttentionLevel,
  type DeadlineState,
} from "@/lib/businessRules";
import type {
  NotificationCategory,
  Priority,
  RequestStatus,
  StockMovementType,
  StockStatus,
  Tone,
} from "@/types";

const STATUS_ICONS: Record<RequestStatus, LucideIcon> = {
  Pendente: CircleDashed,
  "Em análise": Search,
  "Aguardando materiais": Hourglass,
  "Em separação": PackageOpen,
  "Pronta para disponibilização": PackageCheck,
  Concluída: CircleCheck,
  Cancelada: Ban,
};

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <Badge tone={STATUS_META[status].tone} icon={STATUS_ICONS[status]} className={className}>
      {status}
    </Badge>
  );
}

const PRIORITY_ICONS: Record<Priority, LucideIcon> = { Alta: ChevronsUp, Média: Equal, Baixa: ChevronsDown };

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_META[priority].tone} icon={PRIORITY_ICONS[priority]}>
      Prioridade {priority.toLowerCase()}
    </Badge>
  );
}

const STOCK_ICONS: Record<StockStatus, LucideIcon> = {
  Normal: CircleCheck,
  Baixo: TrendingDown,
  Insuficiente: TriangleAlert,
  Indisponível: PackageX,
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return (
    <Badge tone={STOCK_STATUS_META[status].tone} icon={STOCK_ICONS[status]}>
      {status}
    </Badge>
  );
}

const DEADLINE_ICONS: Record<DeadlineState, LucideIcon> = {
  concluida: CircleCheck,
  cancelada: Ban,
  atrasada: CalendarX,
  hoje: CalendarClock,
  proxima: Clock,
  "no-prazo": CalendarCheck,
};

export function DeadlineBadge({ state, days }: { state: DeadlineState; days?: number }) {
  const title =
    days === undefined || state === "concluida" || state === "cancelada"
      ? undefined
      : days < 0
        ? `${Math.abs(days)} dia(s) de atraso`
        : days === 0
          ? "Vence hoje"
          : `Faltam ${days} dia(s)`;
  return (
    <Badge tone={DEADLINE_META[state].tone} icon={DEADLINE_ICONS[state]}>
      <span title={title}>{DEADLINE_META[state].label}</span>
    </Badge>
  );
}

const ATTENTION_ICONS: Record<AttentionLevel, LucideIcon> = {
  critico: TriangleAlert,
  alto: ChevronsUp,
  medio: Equal,
  baixo: ChevronsDown,
};

export function AttentionBadge({ level }: { level: AttentionLevel }) {
  return (
    <Badge tone={ATTENTION_META[level].tone} icon={ATTENTION_ICONS[level]}>
      Atenção {ATTENTION_META[level].label.toLowerCase()}
    </Badge>
  );
}

export const NOTIFICATION_META: Record<NotificationCategory, { label: string; tone: Tone; icon: LucideIcon }> = {
  prazo: { label: "Prazo próximo", tone: "warning", icon: Clock },
  atrasada: { label: "Demanda atrasada", tone: "danger", icon: CalendarX },
  estoque: { label: "Estoque insuficiente", tone: "danger", icon: PackageX },
  nova: { label: "Nova solicitação", tone: "info", icon: Plus },
  separacao: { label: "Separação concluída", tone: "accent", icon: PackageCheck },
  cancelamento: { label: "Solicitação cancelada", tone: "neutral", icon: Ban },
};

export function NotificationBadge({ category }: { category: NotificationCategory }) {
  const meta = NOTIFICATION_META[category];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

export const HISTORY_KIND_META: Record<string, { label: string; tone: Tone }> = {
  criacao: { label: "Criação", tone: "info" },
  edicao: { label: "Edição", tone: "neutral" },
  status: { label: "Status", tone: "primary" },
  separacao: { label: "Separação", tone: "accent" },
  estoque: { label: "Estoque", tone: "warning" },
  sistema: { label: "Sistema", tone: "neutral" },
  cancelamento: { label: "Cancelamento", tone: "danger" },
  movimentacao: { label: "Movimentação", tone: "accent" },
  cadastro: { label: "Cadastro", tone: "success" },
};

export function HistoryKindBadge({ kind }: { kind: string }) {
  const meta = HISTORY_KIND_META[kind] ?? HISTORY_KIND_META.sistema;
  return (
    <Badge tone={meta.tone} icon={FileText}>
      {meta.label}
    </Badge>
  );
}

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const meta = MOVEMENT_META[type];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
