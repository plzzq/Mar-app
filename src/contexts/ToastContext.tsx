import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, Undo2, X, CircleAlert } from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Ação opcional (ex.: "Desfazer"). Só exibir quando a operação for reversível. */
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: number;
  variant: ToastVariant;
}

type ToastFn = (options: ToastOptions) => void;

const ToastContext = createContext<ToastFn | null>(null);

const VARIANTS: Record<ToastVariant, { icon: typeof Info; className: string; iconClass: string; sound: "ok" | "error" | "info" }> = {
  success: { icon: CircleCheck, className: "border-emerald-200", iconClass: "text-emerald-600", sound: "ok" },
  error: { icon: CircleAlert, className: "border-rose-200", iconClass: "text-rose-600", sound: "error" },
  warning: { icon: TriangleAlert, className: "border-amber-300", iconClass: "text-amber-600", sound: "error" },
  info: { icon: Info, className: "border-sky-200", iconClass: "text-sky-600", sound: "info" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const { prefs, notifySound } = useAccessibility();

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (options) => {
      counter.current += 1;
      const id = counter.current;
      setItems((prev) => [...prev.slice(-3), { ...options, id, variant: options.variant ?? "info" }]);
      // Duração configurável + aviso sonoro opcional (preferências de acessibilidade).
      window.setTimeout(() => dismiss(id), options.action ? Math.max(prefs.toastDuration, 8000) : prefs.toastDuration);
      notifySound(VARIANTS[options.variant ?? "info"].sound);
    },
    [dismiss, prefs.toastDuration, notifySound],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((item) => {
          const variant = VARIANTS[item.variant];
          const Icon = variant.icon;
          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className={cn(
                "animate-fade-up pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg",
                variant.className,
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", variant.iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.description && <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>}
                {item.action && (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast deve ser usado dentro de ToastProvider.");
  return toast;
}

/** Toast de sucesso com botão Desfazer (usar apenas após pushUndoSnapshot). */
export function useUndoToast(): (title: string, description: string, onUndo: () => void) => void {
  const toast = useToast();
  return useCallback(
    (title: string, description: string, onUndo: () => void) => {
      toast({ title, description, variant: "success", action: { label: "Desfazer", onClick: onUndo } });
    },
    [toast],
  );
}
