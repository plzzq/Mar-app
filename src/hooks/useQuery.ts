import { useCallback, useEffect, useState, type DependencyList } from "react";
import { toError } from "@/lib/errors";
import { subscribeDemo } from "@/services/demo/demoDb";

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
  /** true apenas no primeiro carregamento (sem dados anteriores). */
  loading: boolean;
  refetch: () => void;
}

/**
 * Executa uma consulta assíncrona com estados de carregamento e erro.
 * Refaz a consulta automaticamente quando os dados de demonstração mudam,
 * o que simula atualizações em tempo real (Supabase Realtime no futuro).
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: DependencyList = []): QueryResult<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: Error | undefined; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, error: undefined, loading: prev.data === undefined }));
    fetcher().then(
      (data) => {
        if (active) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (active) setState((prev) => ({ ...prev, error: toError(error), loading: false }));
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  useEffect(() => subscribeDemo(() => setVersion((v) => v + 1)), []);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, refetch };
}
