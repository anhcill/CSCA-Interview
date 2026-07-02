const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const requestTimeoutMs = 15_000;
const defaultGetCacheMs = 30_000;

type ApiOptions = {
  cacheMs?: number;
  timeoutMs?: number;
  token?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

export function buildApiUrl(path: string, query?: Record<string, string | null | undefined>) {
  const url = new URL(`${apiBaseUrl}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}
const pendingGets = new Map<string, Promise<unknown>>();

export function clearApiCache() {
  memoryCache.clear();
  pendingGets.clear();
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const rawData = await response.text();
    if (!rawData.trim()) return "Máy chủ trả về lỗi không xác định";
    const data = JSON.parse(rawData) as { message?: string };
    return data.message ?? "Máy chủ trả về lỗi không xác định";
  } catch {
    return "Máy chủ trả về lỗi không xác định";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawData = await response.text();
  if (!rawData.trim()) return undefined as T;

  try {
    return JSON.parse(rawData) as T;
  } catch {
    throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ", response.status || 500);
  }
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Máy chủ phản hồi quá lâu. Vui lòng thử lại.", 408);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGet<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const cacheMs = options.cacheMs ?? defaultGetCacheMs;
  const cacheKey = `${path}:${options.token ?? "public"}`;
  if (cacheMs > 0) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) memoryCache.delete(cacheKey);
    const pending = pendingGets.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const request = fetchWithTimeout(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  }, options.timeoutMs).then(async (response) => {
    if (!response.ok) {
      throw new ApiError(await parseApiError(response), response.status);
    }

    const data = await parseJsonResponse<T>(response);
    if (cacheMs > 0) memoryCache.set(cacheKey, { expiresAt: Date.now() + cacheMs, value: data });
    return data;
  }).finally(() => {
    pendingGets.delete(cacheKey);
  });

  if (cacheMs > 0) pendingGets.set(cacheKey, request);
  return request;
}

export async function apiGetText(path: string, options: ApiOptions = {}): Promise<string> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  }, options.timeoutMs);

  if (!response.ok) {
    throw new ApiError(await parseApiError(response), response.status);
  }

  return response.text();
}

export function createEventStream(path: string, onToken: (token: string) => void, onDone?: () => void) {
  const source = new EventSource(buildApiUrl(path), { withCredentials: true });
  source.addEventListener("token", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { token: string };
    onToken(data.token);
  });
  source.addEventListener("done", () => {
    onDone?.();
    source.close();
  });
  source.onerror = () => source.close();
  return source;
}

export function createAuthorizedEventStream(
  path: string,
  token: string | null,
  handlers: {
    onDone?: (data: unknown) => void;
    onError?: (message: string) => void;
    onStatus?: (status: string) => void;
    onToken?: (token: string) => void;
  }
) {
  const source = new EventSource(buildApiUrl(path, { token }), { withCredentials: true });

  source.addEventListener("status", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { status?: string };
    if (data.status) handlers.onStatus?.(data.status);
  });
  source.addEventListener("token", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { token?: string };
    if (data.token) handlers.onToken?.(data.token);
  });
  source.addEventListener("done", (event) => {
    handlers.onDone?.(JSON.parse((event as MessageEvent).data));
    source.close();
  });
  source.addEventListener("error", (event) => {
    if ("data" in event && typeof event.data === "string") {
      try {
        const data = JSON.parse(event.data) as { message?: string };
        handlers.onError?.(data.message ?? "K\u1ebft n\u1ed1i realtime b\u1ecb ng\u1eaft");
      } catch {
        handlers.onError?.("K\u1ebft n\u1ed1i realtime b\u1ecb ng\u1eaft");
      }
    }
    source.close();
  });
  source.onerror = () => {
    handlers.onError?.("K\u1ebft n\u1ed1i realtime b\u1ecb ng\u1eaft");
    source.close();
  };

  return source;
}

type AuthorizedEventStreamHandlers = {
  onDone?: (data: unknown) => void;
  onError?: (message: string) => void;
  onStatus?: (status: string) => void;
  onToken?: (token: string) => void;
};

export type EventStreamHandle = {
  close: () => void;
};

function dispatchSseBlock(block: string, handlers: AuthorizedEventStreamHandlers) {
  let eventName = "message";
  const dataLines: string[] = [];

  block.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  });

  const rawData = dataLines.join("\n");
  const data = rawData
    ? (() => {
        try {
          return JSON.parse(rawData) as Record<string, unknown>;
        } catch {
          return {};
        }
      })()
    : {};

  if (eventName === "status" && typeof data.status === "string") handlers.onStatus?.(data.status);
  if (eventName === "token" && typeof data.token === "string") handlers.onToken?.(data.token);
  if (eventName === "done") handlers.onDone?.(data);
  if (eventName === "error") handlers.onError?.(typeof data.message === "string" ? data.message : "Kết nối realtime bị ngắt");
}

export function createAuthorizedJsonEventStream(
  path: string,
  token: string | null,
  body: unknown,
  handlers: AuthorizedEventStreamHandlers
): EventStreamHandle {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        body: JSON.stringify(body),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        method: "POST",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new ApiError(await parseApiError(response), response.status);
      }

      if (!response.body) {
        throw new Error("Trình duyệt không hỗ trợ đọc luồng phản hồi");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\n\n/);
        buffer = blocks.pop() ?? "";
        blocks.filter((block) => block.trim()).forEach((block) => dispatchSseBlock(block, handlers));
      }

      buffer += decoder.decode();
      if (buffer.trim()) dispatchSseBlock(buffer, handlers);
    } catch (error) {
      if (controller.signal.aborted) return;
      handlers.onError?.(error instanceof Error ? error.message : "Kết nối realtime bị ngắt");
    }
  })();

  return {
    close: () => controller.abort()
  };
}

export async function apiDelete<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    credentials: "include",
    method: "DELETE",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  }, options.timeoutMs);

  if (!response.ok) {
    throw new ApiError(await parseApiError(response), response.status);
  }

  const data = await parseJsonResponse<T>(response);
  clearApiCache();
  return data;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options: ApiOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  }, options.timeoutMs);

  if (!response.ok) {
    throw new ApiError(await parseApiError(response), response.status);
  }

  const data = await parseJsonResponse<T>(response);
  clearApiCache();
  return data;
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options: ApiOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    credentials: "include",
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  }, options.timeoutMs);

  if (!response.ok) {
    throw new ApiError(await parseApiError(response), response.status);
  }

  const data = await parseJsonResponse<T>(response);
  clearApiCache();
  return data;
}
