/* Componentes base de interface (estilo próprio, sem template pronto). */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types";

/* ------------------------------ Botões ------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900",
  secondary: "bg-navy-50 text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-100",
  outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

/* Alvos de toque maiores no celular; mais compactos no desktop. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm lg:h-10",
  lg: "h-12 px-5 text-base",
  icon: "h-11 w-11 lg:h-9 lg:w-9",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ------------------------------ Cartões ----------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 lg:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 text-navy-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Badges ------------------------------ */

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-300",
  info: "bg-sky-50 text-sky-800 ring-sky-300",
  warning: "bg-amber-50 text-amber-900 ring-amber-300",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  danger: "bg-rose-50 text-rose-800 ring-rose-300",
  primary: "bg-blue-50 text-blue-900 ring-blue-300",
  accent: "bg-teal-50 text-teal-800 ring-teal-300",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ----------------------------- Progresso ---------------------------- */

const PROGRESS_TONES: Record<Tone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-600",
  warning: "bg-amber-500",
  success: "bg-emerald-600",
  danger: "bg-rose-600",
  primary: "bg-navy-700",
  accent: "bg-teal-600",
};

export function Progress({
  value,
  label,
  tone = "primary",
  className,
}: {
  value: number;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label ?? "Progresso"}</span>
        <span className="font-semibold tabular-nums text-slate-800">{safe}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progresso"}
        className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-200"
      >
        <div
          className={cn("h-full transition-[width] duration-500 ease-out", PROGRESS_TONES[tone])}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------- Estados de carregamento ------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} aria-hidden="true" />;
}

export function LoadingState({ label = "Carregando dados…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-navy-700" aria-hidden="true" />
        {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar os dados",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-rose-300 bg-rose-50 p-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-100 text-rose-700">
        <TriangleAlert className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-rose-900">{title}</p>
        {message && <p className="mt-1 text-sm text-rose-800">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-9 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Paginação --------------------------- */

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);
  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row">
      <p>
        Mostrando <span className="font-medium text-slate-900">{from}–{to}</span> de{" "}
        <span className="font-medium text-slate-900">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </Button>
        <span className="min-w-[5rem] text-center tabular-nums">
          Página {page} de {pageCount}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Próxima página">
          Próxima
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
