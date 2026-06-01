const BASE = import.meta.env.VITE_API_BASE_URL;

const TOKEN_KEY = 'g2sentry_token';
const REFRESH_KEY = 'g2sentry_refresh_token';

let _refreshPromise: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      return false;
    }
    const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
    localStorage.setItem(TOKEN_KEY, json.data.accessToken);
    localStorage.setItem(REFRESH_KEY, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) {
      headers.set('Authorization', `Bearer ${localStorage.getItem(TOKEN_KEY)}`);
      res = await fetch(`${BASE}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(errBody.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

export const apiGet = <T>(path: string) =>
  apiFetch<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' });

export { TOKEN_KEY, REFRESH_KEY };
