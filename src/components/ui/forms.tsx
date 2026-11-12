/* Campos de formulário acessíveis: rótulo, dica e mensagem de erro associados. */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 lg:text-sm " +
  "placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700 " +
  "disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-rose-600 aria-[invalid=true]:ring-rose-200";

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, error, hint, className, children }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wrapperClassName?: string;
}

export function Input({ id, label, error, hint, required, wrapperClassName, className, ...props }: InputProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wrapperClassName?: string;
}

export function Textarea({ id, label, error, hint, required, wrapperClassName, className, ...props }: TextareaProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, "min-h-[96px] resize-y", className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wrapperClassName?: string;
}

export function Select({ id, label, error, hint, required, wrapperClassName, className, children, ...props }: SelectProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, "pr-8", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Alternância liga/desliga com rótulo e descrição. */
export function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-1 disabled:opacity-50",
          checked ? "bg-navy-700" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
