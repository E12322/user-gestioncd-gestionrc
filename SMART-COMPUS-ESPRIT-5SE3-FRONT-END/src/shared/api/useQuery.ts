import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./errors";

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  refetch: () => void;
}

/** Hook de lecture minimal (sans dépendance externe). Chaque hook de feature l'enveloppe. */
export function useQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [isLoading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(undefined);
    fetcherRef
      .current(ctrl.signal)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof ApiError ? e : new ApiError(500, (e as Error).message));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [tick, ...deps]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, isLoading, refetch };
}
