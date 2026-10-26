import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Alerta antes de sair com alterações não salvas:
 * - bloqueia a navegação interna (React Router) com diálogo nativo;
 * - avisa ao fechar/recarregar a aba (beforeunload).
 */
export function useUnsavedChanges(dirty: boolean): void {
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
