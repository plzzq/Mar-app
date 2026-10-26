/* Partes reutilizáveis do módulo de solicitações: etapas do fluxo e linha do tempo. */
import { Ban, Check } from "lucide-react";
import { REQUEST_STATUSES, type HistoryEntry, type RequestStatus } from "@/types";
import { formatDateTime, cn } from "@/lib/utils";
import { HistoryKindBadge } from "@/components/common/DomainBadges";

/** Etapas lineares do fluxo (Cancelada é terminal e aparece em destaque próprio). */
const FLOW_STEPS: RequestStatus[] = REQUEST_STATUSES.filter((s) => s !== "Cancelada");

export function StatusStepper({ status }: { status: RequestStatus }) {
  if (status === "Cancelada") {
    return (
      <div className="flex flex-wrap items-center gap-2" role="note">
        {FLOW_STEPS.map((step) => (
          <span
            key={step}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">
              —
            </span>
            {step}
          </span>
        ))}
        <span className="flex items-center gap-2 rounded-md border border-stone-400 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800">
          <Ban className="h-4 w-4" aria-hidden="true" />
          Cancelada (etapa atual)
        </span>
      </div>
    );
  }

  const currentIndex = FLOW_STEPS.indexOf(status);
  return (
    <ol aria-label="Etapas do fluxo de atendimento" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {FLOW_STEPS.map((step, index) => {
        const isCurrent = step === status;
        const isDone = index < currentIndex || status === "Concluída";
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
              isCurrent && "border-navy-700 bg-navy-50 text-navy-900",
              !isCurrent && isDone && "border-emerald-200 bg-emerald-50/60 text-emerald-800",
              !isCurrent && !isDone && "border-slate-200 bg-white text-slate-500",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                isCurrent && "bg-navy-700 text-white",
                !isCurrent && isDone && "bg-emerald-600 text-white",
                !isCurrent && !isDone && "bg-slate-200 text-slate-600",
              )}
            >
              {!isCurrent && isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
            </span>
            <span className="leading-tight">{step}</span>
            {isCurrent && <span className="sr-only">(etapa atual)</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryTimeline({ entries, emptyText = "Nenhum registro até o momento." }: { entries: HistoryEntry[]; emptyText?: string }) {
  if (entries.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-navy-700 ring-4 ring-white" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <time dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time>
            <span aria-hidden="true">·</span>
            <span>{entry.actor}</span>
            <HistoryKindBadge kind={entry.kind} />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {entry.action}
            {entry.from && entry.to && (
              <span className="font-normal text-slate-600">
                {" "}
                — {entry.from} → {entry.to}
              </span>
            )}
          </p>
          {entry.details && <p className="mt-0.5 text-sm text-slate-600">{entry.details}</p>}
        </li>
      ))}
    </ol>
  );
}
