import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

export type QueryState<T> =
  | { status: "loading"; data: null; error: null; loadedAt: null }
  | { status: "success"; data: T; error: null; loadedAt: number }
  | { status: "error"; data: null; error: ApiError; loadedAt: null };

const LOADING = { status: "loading", data: null, error: null, loadedAt: null } as const;

/**
 * Minimal data-fetching hook: loading, success, and error states, plus retry.
 * `key` identifies the request; change it to refetch.
 */
export function useApiQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
): QueryState<T> & { retry: () => void } {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QueryState<T>>(LOADING);

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setState({ status: "success", data, error: null, loadedAt: Date.now() });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", data: null, error: ApiError.from(error), loadedAt: null });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((count) => count + 1);
  }, []);

  return { ...state, retry };
}
