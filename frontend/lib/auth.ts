/** Auth client: token storage + the `/api/auth/*` calls. */

const TOKEN_KEY = "prelegal.token";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface AuthUser {
  id: number;
  email: string;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode / storage disabled */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface AuthPayload {
  access_token: string;
  user: AuthUser;
}

async function authPost(path: string, body: unknown): Promise<AuthPayload> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError(0, "Couldn't reach the server. Is the backend running?");
  }
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new AuthError(res.status, String(data.detail ?? "Something went wrong"));
  }
  return data as AuthPayload;
}

export function register(email: string, password: string): Promise<AuthPayload> {
  return authPost("/api/auth/register", { email, password });
}

export function login(email: string, password: string): Promise<AuthPayload> {
  return authPost("/api/auth/login", { email, password });
}

/** Resolve the current user from a stored token, or null. Clears an invalid token. */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}
