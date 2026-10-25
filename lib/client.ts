'use client';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = await res.json().catch(() => ({ error: { message: 'Réponse serveur illisible.' } }));
  if (!res.ok) {
    if (res.status === 401 && !url.includes('/auth/')) window.location.replace('/login');
    throw new ApiError(
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || data.message || 'La demande a échoué. Réessaie.',
      res.status,
    );
  }
  return data as T;
}
export const mutation = <T>(url: string, body: unknown, method = 'POST') =>
  request<T>(url, { method, body: JSON.stringify(body) });
