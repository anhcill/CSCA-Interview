import { ApiError, apiGet, apiPost, clearApiCache } from "./api";

export const authSessionChangedEvent = "ai-phongvan-auth-session-changed";
const loginWelcomePendingKey = "moly:login-welcome-pending";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  avatarUrl: string | null;
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
let refreshTimer: number | null = null;

function notifyAuthSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(authSessionChangedEvent, { detail: { user: currentUser } }));
}

function scheduleRefresh() {
  if (typeof window === "undefined") return;
  if (refreshTimer) window.clearTimeout(refreshTimer);

  refreshTimer = window.setTimeout(() => {
    void refreshAuthSession().catch(() => clearAuthSession());
  }, 13 * 60 * 1000);
}

export function saveAuthSession(data: AuthResponse) {
  accessToken = data.token;
  currentUser = data.user;
  scheduleRefresh();
  notifyAuthSessionChanged();
}

export function markLoginWelcomePending() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(loginWelcomePendingKey, "true");
}

export function consumeLoginWelcomePending() {
  if (typeof window === "undefined") return false;
  const pending = sessionStorage.getItem(loginWelcomePendingKey) === "true";
  if (pending) sessionStorage.removeItem(loginWelcomePendingKey);
  return pending;
}

export function getAuthToken() {
  return accessToken;
}

export function getStoredUser(): AuthUser | null {
  return currentUser;
}

export function clearAuthSession() {
  if (refreshTimer && typeof window !== "undefined") {
    window.clearTimeout(refreshTimer);
  }
  refreshTimer = null;
  accessToken = null;
  currentUser = null;
  clearApiCache();
  notifyAuthSessionChanged();
}

export async function refreshAuthSession() {
  const data = await apiPost<AuthResponse>("/api/auth/refresh");
  saveAuthSession(data);
  return data;
}

export async function ensureAuthSession() {
  if (accessToken && currentUser) {
    return { token: accessToken, user: currentUser };
  }

  try {
    const data = await refreshAuthSession();
    return { token: data.token, user: data.user };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 408 || error.status >= 500)) {
      throw error;
    }

    clearAuthSession();
    return null;
  }
}

export async function registerAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}) {
  return apiPost<AuthResponse>("/api/auth/register", input);
}

export async function loginAccount(input: { email: string; password: string }) {
  return apiPost<AuthResponse>("/api/auth/login", input);
}

export async function logoutAccount() {
  const token = getAuthToken();
  try {
    await apiPost<{ message: string }>("/api/auth/logout", undefined, { token });
  } finally {
    clearAuthSession();
  }
}

export async function fetchCurrentUser() {
  const session = await ensureAuthSession();
  if (!session) {
    return null;
  }

  const data = await apiGet<{ user: AuthUser }>("/api/auth/me", { cacheMs: 0, token: session.token });
  currentUser = data.user;
  notifyAuthSessionChanged();
  return data;
}
