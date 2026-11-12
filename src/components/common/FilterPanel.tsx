import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * Painel de filtros recolhível no celular.
 * No desktop (lg) os filtros ficam sempre visíveis.
 */
export function FilterPanel({
  children,
  activeCount,
  contentClassName,
}: {
  children: ReactNode;
  activeCount: number;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const visible = isDesktop || open;

  return (
    <>
      {!isDesktop && (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-navy-800"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros
            {activeCount > 0 && (
              <span className="rounded-sm bg-navy-800 px-1.5 py-0.5 text-xs font-semibold text-white">{activeCount}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
          {activeCount > 0 && <span className="text-xs text-slate-500">{activeCount} ativo(s)</span>}
        </div>
      )}

      {visible && (
        <div className={cn("border-t border-slate-200 p-4 lg:border-t-0 lg:p-5", contentClassName)}>{children}</div>
      )}
    </>
  );
}
