import './setup';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api, RequestError } from '../src/lib/backend-client';
import { useWorkspaceSave } from '../src/lib/use-workspace-save';

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

test('regular requests time out while reading the body and report non-JSON HTTP errors', async () => {
  globalThis.fetch = async (_url, options) =>
    new Response(
      new ReadableStream({
        start(controller) {
          options?.signal?.addEventListener('abort', () =>
            controller.error(options.signal?.reason),
          );
        },
      }),
    );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(api('companies', undefined, undefined, { timeoutMs: 15 }), /timed out/);
  } finally {
    clearTimeout(keepAlive);
  }
  globalThis.fetch = async () => new Response('<html>Service unavailable</html>', { status: 503 });
  await assert.rejects(
    api('companies'),
    (error: unknown) => error instanceof RequestError && error.status === 503 && error.retryable,
  );
});

function SettingsProbe({ name }: { name: string }) {
  const save = useWorkspaceSave('company/workspace', JSON.stringify({ name }), 4);
  return (
    <div>
      <span>{name}</span>
      {save.error && <p role="alert">{save.error}</p>}
      {save.retry && <button onClick={save.retry}>Retry settings save</button>}
    </div>
  );
}

test('settings reuse the original key and version through automatic and manual retries, then save newer edits', async () => {
  const calls: { key: string | null; body: { version: number; data: { name: string } } }[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    calls.push({ body, key: new Headers(options?.headers).get('Idempotency-Key') });
    if (calls.length <= 3) throw new TypeError('Connection lost');
    return Response.json({ version: body.version + 1 });
  };
  const ui = render(<SettingsProbe name="Original" />);
  ui.rerender(<SettingsProbe name="First edit" />);
  await waitFor(() => assert.equal(calls.length, 3), { timeout: 4500 });
  ui.rerender(<SettingsProbe name="Newer edit" />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry settings save' }));
  await waitFor(() => assert.equal(calls.length, 5), { timeout: 3000 });
  assert.ok(
    calls
      .slice(0, 4)
      .every(
        (call) =>
          call.key === calls[0].key &&
          call.body.version === 4 &&
          call.body.data.name === 'First edit',
      ),
  );
  assert.notEqual(calls[4].key, calls[0].key);
  assert.deepEqual(calls[4].body, { version: 5, data: { name: 'Newer edit' } });
});

test('settings version conflicts preserve local edits and stop automatic retry', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: 'Version changed' }, { status: 409 });
  };
  const ui = render(<SettingsProbe name="Original" />);
  ui.rerender(<SettingsProbe name="My local edit" />);
  assert.match((await screen.findByRole('alert')).textContent ?? '', /changed on the server/);
  assert.ok(screen.getByText('My local edit'));
  assert.equal(screen.queryByRole('button', { name: 'Retry settings save' }), null);
  assert.equal(calls, 1);
});
