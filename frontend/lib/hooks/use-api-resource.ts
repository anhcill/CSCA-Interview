"use client";

import { useEffect, useState } from "react";

const resourceCache = new Map<string, { expiresAt: number; value: unknown }>();

export function useApiResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean; staleMs?: number } = {}
) {
  const enabled = options.enabled ?? true;
  const staleMs = options.staleMs ?? 30_000;
  const [data, setData] = useState<T | null>(() => {
    const cached = resourceCache.get(key);
    return cached ? (cached.value as T) : null;
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(() => !resourceCache.has(key));
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let ignore = false;
    const cached = resourceCache.get(key);
    if (cached) {
      setData(cached.value as T);
      setIsLoading(false);
      if (cached.expiresAt > Date.now()) return;
    }

    setIsValidating(true);
    setIsLoading(!cached);
    fetcher()
      .then((value) => {
        if (ignore) return;
        resourceCache.set(key, { expiresAt: Date.now() + staleMs, value });
        setData(value);
        setError("");
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
          setIsValidating(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [enabled, fetcher, key, staleMs]);

  return { data, error, isLoading, isValidating };
}

export function clearApiResource(keyPrefix?: string) {
  if (!keyPrefix) {
    resourceCache.clear();
    return;
  }

  Array.from(resourceCache.keys()).forEach((key) => {
    if (key.startsWith(keyPrefix)) resourceCache.delete(key);
  });
}
