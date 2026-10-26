/* ------------------------------------------------------------------ */
/* Utilitários de teclado compartilhados por menus, abas, listas e     */
/* atalhos globais. Nunca capturam teclas durante a digitação.         */
/* ------------------------------------------------------------------ */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/** true quando o foco está em um campo de digitação ou controle nativo. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export type ListOrientation = "horizontal" | "vertical";

interface ListKeyOptions {
  count: number;
  index: number;
  onChange: (next: number) => void;
  orientation?: ListOrientation;
  /** Home/End pula para o primeiro/último item. */
  homeEnd?: boolean;
}

/**
 * Navegação por setas/Home/End em listas com padrão de acessibilidade
 * (abas, menus, listas de mensagens). Retorna true se a tecla foi tratada.
 */
export function handleListKeys(
  event: ReactKeyboardEvent,
  { count, index, onChange, orientation = "vertical", homeEnd = true }: ListKeyOptions,
): boolean {
  if (count === 0) return false;
  const horizontal = orientation === "horizontal";
  const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
  const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";

  switch (event.key) {
    case nextKey:
      event.preventDefault();
      onChange(index >= count - 1 ? 0 : index + 1);
      return true;
    case prevKey:
      event.preventDefault();
      onChange(index <= 0 ? count - 1 : index - 1);
      return true;
    case "Home":
      if (!homeEnd) return false;
      event.preventDefault();
      onChange(0);
      return true;
    case "End":
      if (!homeEnd) return false;
      event.preventDefault();
      onChange(count - 1);
      return true;
    default:
      return false;
  }
}

/**
 * Atalhos globais: só captura quando o usuário NÃO está digitando,
 * não usa modificador de navegador em uso (Ctrl/Cmd/Meta) e o foco
 * não está em controle de leitor de tela.
 */
export function canUseGlobalShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (isTypingTarget(event.target)) return false;
  if (event.target instanceof HTMLElement && event.target.closest("[role='dialog'],[role='menu'],[role='listbox']")) {
    // Dentro de diálogos/menu, as teclas pertencem ao próprio componente.
    return false;
  }
  return true;
}
