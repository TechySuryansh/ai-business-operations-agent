'use client';

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
  get retryable() {
    return this.status === undefined || [408, 500, 502, 503, 504].includes(this.status);
  }
}

export async function api<T = unknown>(
  path: string,
  payload?: unknown,
  key?: string,
  { signal, timeoutMs = 15000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const response = await fetch(`/api/backend/${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      signal: requestSignal,
      headers:
        payload === undefined
          ? {}
          : {
              'Content-Type': 'application/json',
              'Idempotency-Key': key ?? crypto.randomUUID(),
            },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const result = await response.json().catch((error) => {
      if (requestSignal.aborted) throw error;
      if (response.ok)
        throw new RequestError('The server returned an unreadable response. Try again.');
      return null;
    });
    if (!response.ok)
      throw new RequestError(
        typeof result?.error === 'string'
          ? result.error
          : `Request failed (HTTP ${response.status}).`,
        response.status,
      );
    return result as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadline.aborted) throw new RequestError('The request timed out. Try again.');
    if (error instanceof RequestError) throw error;
    throw new RequestError('Could not reach the server. Check your connection and try again.');
  }
}

export async function streamAssistant<T>(
  path: string,
  payload: unknown,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Assistant request failed. Please retry.');
  }
  if (!response.body) throw new Error('Assistant stream is unavailable. Please retry.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'delta') onDelta(event.text);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'done') return event.result as T;
      }
      if (done) throw new Error('The answer was interrupted. Please retry.');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
