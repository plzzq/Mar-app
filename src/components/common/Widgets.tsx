/* Widgets reutilizáveis: indicadores, alertas de estoque e marcação de dados de demonstração. */
import type { LucideIcon } from "lucide-react";
import { Info, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatNumber } from "@/lib/utils";
import type { Tone } from "@/types";

const ICON_TONES: Record<Tone, string> = {
  primary: "bg-navy-50 text-navy-700",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-sky-50 text-sky-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-rose-50 text-rose-700",
  accent: "bg-teal-50 text-teal-700",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", ICON_TONES[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900 lg:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </>
  );

  const base = "block rounded-lg border border-slate-200 bg-white p-4 lg:p-5";
  if (!to) return <div className={base}>{content}</div>;
  return (
    <Link
      to={to}
      className={cn(base, "transition-colors duration-150 hover:border-navy-300 hover:bg-navy-50/30")}
    >
      {content}
    </Link>
  );
}

export interface ShortageItem {
  key: string;
  name: string;
  unit: string;
  required: number;
  available: number;
  difference: number;
  to?: string;
}

/** Mostra a diferença entre a quantidade necessária e a disponível. */
export function ShortageAlert({
  items,
  title = "Materiais insuficientes",
  className,
}: {
  items: ShortageItem[];
  title?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className={cn("rounded-lg border border-rose-200 bg-rose-50 p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="rounded-md border border-rose-100 bg-white px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {item.to ? (
                <Link to={item.to} className="font-medium text-navy-800 underline-offset-2 hover:underline">
                  {item.name}
                </Link>
              ) : (
                <span className="font-medium text-slate-900">{item.name}</span>
              )}
              <span className="rounded-sm bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                Faltam {formatNumber(item.difference)} {item.unit}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Necessário: {formatNumber(item.required)} {item.unit} · Disponível: {formatNumber(item.available)} {item.unit}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marcação discreta de dados fictícios (sem efeito decorativo). */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-slate-500", className)}>
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
      Dados de demonstração
    </span>
  );
}
