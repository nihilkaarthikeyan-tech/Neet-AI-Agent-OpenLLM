const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('neet_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json() as T;

  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? 'Request failed');
  }

  return data;
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),
  del: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
