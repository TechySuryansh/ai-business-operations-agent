'use client';
export async function api<T = unknown>(path: string, payload?: unknown, key?: string): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    method: payload === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers:
      payload === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'Idempotency-Key': key ?? crypto.randomUUID() },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result as T;
}
