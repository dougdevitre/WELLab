import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  retry: () => void;
}

export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  timeoutMs = 30000
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const retryCount = useRef(0);

  const execute = useCallback(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcher(controller.signal)
      .then((data) => {
        setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setState({ data: null, loading: false, error: message });
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    retryCount.current = 0;
    const cleanup = execute();
    return cleanup;
  }, [execute]);

  const retry = useCallback(() => {
    retryCount.current += 1;
    execute();
  }, [execute]);

  return { ...state, retry };
}
