import { useEffect } from "react";

/**
 * Alerta antes de fechar/recarregar a aba com alterações não salvas.
 * Nota: useBlocker não é compatível com HashRouter, por isso usa apenas beforeunload.
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
