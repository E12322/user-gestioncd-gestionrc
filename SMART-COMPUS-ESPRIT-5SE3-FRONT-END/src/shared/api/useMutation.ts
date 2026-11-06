import { useCallback, useRef, useState } from "react";
import { ApiError } from "./errors";

/** Hook d'écriture minimal : `mutate` relance l'erreur (ApiError) pour que l'appelant l'affiche à sa façon. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mutate = useCallback(async (...args: A): Promise<R> => {
    setPending(true);
    setError(undefined);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(500, (e as Error).message);
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return { mutate, isPending, error, reset: () => setError(undefined) };
}
