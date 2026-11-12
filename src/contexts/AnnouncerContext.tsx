/* ------------------------------------------------------------------ */
/* Regiões de anúncio para leitores de tela.                          */
/* useAnnounce envia mensagens não intrusivas (aria-live polite);      */
/* reserve assertive=true para erros realmente urgentes.               */
/* ------------------------------------------------------------------ */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type AnnounceFn = (message: string, options?: { assertive?: boolean }) => void;

const AnnouncerContext = createContext<AnnounceFn | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timerRef = useRef<number | null>(null);

  const announce = useCallback<AnnounceFn>((message, options) => {
    const setter = options?.assertive ? setAssertive : setPolite;
    // Limpa antes para que a mesma mensagem possa ser anunciada de novo.
    setter("");
    window.setTimeout(() => setter(message), 60);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" role="alert" className="sr-only">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): AnnounceFn {
  const announce = useContext(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce deve ser usado dentro de AnnouncerProvider.");
  return announce;
}
