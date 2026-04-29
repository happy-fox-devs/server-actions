"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OptimisticUpdate,
  SAROptions,
  SARReturn,
  ServerActionResponse,
} from "../types";
import { serverActionRequest } from "../utils/request";

/**
 * Advanced React hook for Server Actions with SWR-like functionality
 * 
 * Provides caching, deduplication, optimistic updates, and automatic revalidation
 * for React Server Actions. Similar to SWR but specifically designed for server actions.
 * 
 * @template T - The type of data returned by the server action
 * 
 * @param options - Configuration object for the hook behavior
 * @returns Object with state and functions to manage the server action
 * 
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, execute, loading, error } = useSAR({
 *     action: getUserAction,
 *     condition: !!userId,
 *     cacheTime: 5000,
 *     revalidateOnFocus: true,
 *     onSuccess: (user) => toast.success(`Welcome ${user.name}!`)
 *   });
 * 
 *   useEffect(() => {
 *     execute({ userId });
 *   }, [userId]);
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error error={error} />;
 *   if (!user) return <NotFound />;
 * 
 *   return <div>Hello {user.name}!</div>;
 * }
 * ```
 */
export function useSAR<T>({
  action: serverAction,
  condition,
  cacheTime = 0,
  revalidateOnMount = true,
  revalidateOnFocus = false,
  dedupingInterval = 2000,
  executeOnMount = true,
  initialExecuteData,
  onSuccess,
  onError,
}: SAROptions<T>): SARReturn<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<T>();

  const isMountedRef = useRef(false);
  const loadingRef = useRef(false);
  const lastRequestDataRef = useRef<FormData | Record<string, any> | undefined>(
    undefined
  );

  // References for AbortController and request tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);

  // Cache management
  const cacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup resources on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Executes the server action with the provided data
   * 
   * Includes deduplication, caching, and error handling
   */
  const execute = useCallback(
    async (
      requestData?: FormData | Record<string, any>
    ): Promise<ServerActionResponse<T> | void> => {
      // Check execution condition
      if (typeof condition !== "undefined" && !condition) {
        return;
      }

      // Store data for refetch functionality
      if (requestData) {
        lastRequestDataRef.current = requestData;
      }

      // Deduplication: prevent rapid successive requests
      const currentTime = Date.now();
      if (
        currentTime - lastRequestTimeRef.current < dedupingInterval &&
        loadingRef.current
      ) {
        return;
      }
      lastRequestTimeRef.current = currentTime;

      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for cancellation
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      loadingRef.current = true;
      setLoading(true);
      setError(undefined);

      try {
        const response = await serverActionRequest<T>(
          serverAction,
          requestData || lastRequestDataRef.current || {}
        );

        if (signal.aborted) return;

        if (response.ok) {
          setData(response.data);

          // Success callback
          if (onSuccess) {
            onSuccess(response.data);
          }

          // Set cache timeout if configured
          if (cacheTime > 0) {
            if (cacheTimeoutRef.current) {
              clearTimeout(cacheTimeoutRef.current);
            }
            cacheTimeoutRef.current = setTimeout(() => {
              setData(undefined);
            }, cacheTime);
          }
        } else {
          const errorMessage = response.message || "Operation failed";
          setError(errorMessage);

          // Error callback
          if (onError) {
            onError(errorMessage);
          }
        }

        return response;
      } catch (err: any) {
        if (!signal.aborted) {
          const errorMessage = err.message || "An unexpected error occurred";
          setError(errorMessage);

          // Error callback
          if (onError) {
            onError(errorMessage);
          }
        }
      } finally {
        if (!signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [
      condition,
      serverAction,
      cacheTime,
      dedupingInterval,
      onSuccess,
      onError,
    ]
  );

  /**
   * Refetches data using the last request parameters
   */
  const refetch =
    useCallback(async (): Promise<ServerActionResponse<T> | void> => {
      return await execute(lastRequestDataRef.current);
    }, [execute]);

  /**
   * Resets all state and clears cache
   */
  const reset = useCallback(() => {
    setData(undefined);
    setError(undefined);
    lastRequestDataRef.current = undefined;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (cacheTimeoutRef.current) {
      clearTimeout(cacheTimeoutRef.current);
    }
  }, []);

  /**
   * Directly mutates the local data without executing the server action
   */
  const mutate = useCallback((newData: T | undefined) => {
    setData(newData);

    // Reset cache if active
    if (cacheTimeoutRef.current) {
      clearTimeout(cacheTimeoutRef.current);
      cacheTimeoutRef.current = null;
    }
  }, []);

  /**
   * Helper for optimistic updates using an updater function
   */
  const optimisticMutate = useCallback((updateFn: OptimisticUpdate<T>) => {
    setData((current) => updateFn(current));
  }, []);

  // Revalidation on window focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [revalidateOnFocus, refetch]);

  // Initial execution on mount
  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    if (!executeOnMount) return;

    if ((revalidateOnMount && typeof condition === "undefined") || condition) {
      execute(initialExecuteData);
    }
  }, [executeOnMount, revalidateOnMount, condition, execute, initialExecuteData]);

  return {
    data,
    error,
    loading,
    execute,
    refetch,
    mutate,
    optimisticMutate,
    reset,
  };
}
