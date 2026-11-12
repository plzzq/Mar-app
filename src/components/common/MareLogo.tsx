/* Identidade visual: marca da Maré e símbolo da Mar.IA (SVG próprio). */
import { cn } from "@/lib/utils";

export function MareMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#8DA9C4" />
      <path d="M6 15c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke="#0B2545" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 21c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke="#0B2545" strokeWidth="2.6" strokeLinecap="round" opacity=".75" />
      <path d="M6 27c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke="#0B2545" strokeWidth="2.6" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function MarIAMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#1D4E89" />
      <path d="M9 22c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3.5 5-1" stroke="#E0F2FE" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 28c2.5-3 5-3 7.5 0s5 3 7.5 0" stroke="#8DA9C4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="29" cy="12" r="3" fill="#7DD3FC" />
    </svg>
  );
}

export function MareLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <MareMark className="h-9 w-9 shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="text-base font-semibold text-white">Maré</p>
          <p className="truncate text-[11px] uppercase tracking-[0.16em] text-sky-200/80">Plataforma industrial</p>
        </div>
      )}
    </div>
  );
}
