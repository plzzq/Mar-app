/* Diálogo modal acessível:
   - Esc fecha; Tab fica preso dentro do diálogo (focus trap);
   - foco vai ao primeiro controle ao abrir e volta ao gatilho ao fechar;
   - nome acessível e descrição associados (aria-labelledby/aria-describedby). */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./index";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Elemento a receber o foco ao abrir (padrão: primeiro controle). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

export function Modal({ open, onClose, title, description, children, footer, size = "md", initialFocusRef }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // Focus trap: mantém a navegação dentro do diálogo.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    const focusTarget =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button") ??
      panelRef.current;
    focusTarget?.focus();
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
      // Devolve o foco ao elemento que abriu o diálogo.
      previous?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-desc` : undefined}
        tabIndex={-1}
        className={cn(
          "animate-fade-up flex max-h-[94dvh] w-full flex-col rounded-t-lg bg-white shadow-xl sm:rounded-lg",
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-navy-900">
              {title}
            </h2>
            {description && (
              <p id={`${titleId}-desc`} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="-mr-1 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar diálogo"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-4 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação explícita para ações importantes. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading} className="sm:min-w-32">
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading} className="sm:min-w-32">
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
