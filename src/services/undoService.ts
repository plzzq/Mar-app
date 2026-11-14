/* ------------------------------------------------------------------ */
/* Desfazer alterações (compensação segura para a etapa local).       */
/* - Antes de cada mutação reversível, o serviço captura um snapshot. */
/* - "Desfazer" restaura o snapshot; tudo fica registrado no histórico*/
/* - No Supabase, o equivalente serão transações + audit log (ver     */
/*   supabase/schema.sql); a interface (toast com "Desfazer") não muda.*/
/* ------------------------------------------------------------------ */
import { getDemoState, replaceDemoState, type DemoState } from "./demo/demoDb";

interface UndoEntry {
  id: string;
  label: string;
  timestamp: string;
  snapshot: DemoState;
}

const MAX_ENTRIES = 20;
const stack: UndoEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Captura o estado atual para permitir desfazer a próxima mutação. */
export function pushUndoSnapshot(label: string): void {
  stack.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    timestamp: new Date().toISOString(),
    snapshot: structuredClone(getDemoState()),
  });
  if (stack.length > MAX_ENTRIES) stack.splice(0, stack.length - MAX_ENTRIES);
  emit();
}

/** Há alguma operação que pode ser desfeita? */
export function canUndo(): boolean {
  return stack.length > 0;
}

export function lastUndoLabel(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].label : null;
}

/**
 * Restaura o snapshot anterior e registra o desfazer no histórico.
 * Retorna o rótulo da operação desfeita ou null se não houver.
 */
export function undoLastAction(actorName: string): string | null {
  const entry = stack.pop();
  if (!entry) return null;
  const restored = structuredClone(entry.snapshot);
  restored.history = [
    {
      id: `hist-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      kind: "sistema" as const,
      actor: actorName,
      action: "Operação desfeita",
      details: entry.label,
    },
    ...restored.history,
  ];
  replaceDemoState(restored);
  emit();
  return entry.label;
}

/** Limpa a pilha (ex.: ao trocar de usuário ou restaurar demonstração). */
export function clearUndoStack(): void {
  stack.length = 0;
  emit();
}
