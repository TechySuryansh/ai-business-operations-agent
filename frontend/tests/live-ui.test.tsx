import './setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BusinessProvider, type LiveBootstrap } from '../src/lib/business-context';
import { RecordEditor, Records } from '../src/components/modules/records';
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  localStorage.clear();
  globalThis.fetch = originalFetch;
});
const customerId = '10000000-0000-4000-8000-000000000001',
  productId = '10000000-0000-4000-8000-000000000002';
const live: LiveBootstrap = {
  company: {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Real company',
    timeZone: 'UTC',
    currency: 'USD',
  },
  role: 'owner',
  businessDate: '2026-11-16',
  audit: [],
  data: {
    live: true,
    customers: [
      {
        id: customerId,
        name: 'Real customer',
        contact: 'A',
        email: 'a@example.invalid',
        location: 'City',
        status: 'Active',
        revenue: 0,
        orders: 0,
        lastOrder: '2026-11-16',
      },
    ],
    products: [
      {
        id: productId,
        name: 'Real widget',
        category: 'Parts',
        sku: 'W1',
        stock: 10,
        reorder: 2,
        price: 10.25,
        sold: 0,
        revenue: 0,
        supplier: 'Supplier',
      },
    ],
    orders: [],
    invoices: [],
  },
};
test('live provider ignores browser demo records', async () => {
  globalThis.fetch = async () =>
    Response.json({ rows: live.data.customers, total: 1, allTotal: 1 });
  localStorage.setItem(
    'nexus-records-v1',
    JSON.stringify({ data: { customers: [{ name: 'Leaked demo' }] } }),
  );
  render(
    <BusinessProvider live={live}>
      <Records kind="Customers" onSelect={() => {}} notify={() => {}} />
    </BusinessProvider>,
  );
  assert.ok(await screen.findByText('Real customer'));
  assert.equal(screen.queryByText('Leaked demo'), null);
});
test('live order form sends product quantities without trusting browser totals', async () => {
  const requests: { url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json({ result: { id: 'created' }, patch: { data: {}, audit: [] } });
  };
  let done = false;
  render(
    <BusinessProvider live={live}>
      <RecordEditor
        kind="Sales"
        done={() => {
          done = true;
        }}
        notify={() => {}}
      />
    </BusinessProvider>,
  );
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: customerId } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(done, true));
  assert.deepEqual(requests[0].body, {
    action: 'order.create',
    payload: { customerId, lines: [{ productId, quantity: 2 }] },
  });
  assert.equal(localStorage.getItem('nexus-records-v1'), null);
});
test('live save failure leaves form open and shows server error', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Insufficient stock.' }, { status: 409 });
  let done = false;
  render(
    <BusinessProvider live={live}>
      <RecordEditor
        kind="Sales"
        done={() => {
          done = true;
        }}
        notify={() => {}}
      />
    </BusinessProvider>,
  );
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: customerId } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    assert.match(screen.getByRole('alert').textContent ?? '', /Insufficient stock/),
  );
  assert.equal(done, false);
});

test('chat remains usable if history fails, streams a reply and blocks conversation switching', async () => {
  const { Assistant } = await import('../src/components/modules/assistant');
  let finish: (() => void) | undefined;
  globalThis.fetch = async (_url, init) => {
    if (!init?.body) return Response.json({ error: 'History unavailable' }, { status: 503 });
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'delta', text: 'Answer in progress' }) + '\n'),
          );
          finish = () => {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'done',
                  result: {
                    id: customerId,
                    messages: [{ id: productId, role: 'assistant', text: 'Final answer' }],
                  },
                }) + '\n',
              ),
            );
            controller.close();
          };
        },
      }),
    );
  };
  render(
    <BusinessProvider live={live}>
      <Assistant initialPrompt="" clearPrompt={() => {}} navigate={() => {}} notify={() => {}} />
    </BusinessProvider>,
  );
  const input = screen.getByLabelText('Ask a business question') as HTMLTextAreaElement;
  await waitFor(() => assert.equal(input.disabled, false));
  fireEvent.change(input, { target: { value: 'Explain revenue' } });
  fireEvent.click(screen.getByLabelText('Send question'));
  await screen.findByText('Answer in progress');
  assert.equal(input.disabled, true);
  assert.equal(
    (screen.getByText('New conversation').closest('button') as HTMLButtonElement).disabled,
    true,
  );
  finish!();
  await screen.findByText('Final answer');
  await waitFor(() => assert.equal(input.disabled, false));
});

test('successful live save applies a delta without fetching the snapshot', async () => {
  const { useBusiness } = await import('../src/lib/business-context');
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({
      result: { id: productId },
      patch: {
        data: { products: [{ ...live.data.products[0], stock: 7, version: 2 }] },
        audit: [],
      },
    });
  };
  function Probe() {
    const { data, execute } = useBusiness();
    return (
      <>
        <span>stock:{data.products[0].stock}</span>
        <button onClick={() => execute('product.save', {})}>Update</button>
      </>
    );
  }
  render(
    <BusinessProvider live={live}>
      <Probe />
    </BusinessProvider>,
  );
  fireEvent.click(screen.getByText('Update'));
  await screen.findByText('stock:7');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/command$/);
});

test('live record tables fetch server pages and filters', async () => {
  window.history.replaceState(null, '', '#inventory');
  const urls: URL[] = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url), 'http://localhost');
    urls.push(u);
    const page = Number(u.searchParams.get('page'));
    return Response.json({
      rows: [
        { ...live.data.products[0], name: page === 2 ? 'Second server page' : 'First server page' },
      ],
      total: 11,
      allTotal: 11,
    });
  };
  render(
    <BusinessProvider live={live}>
      <Records kind="Inventory" onSelect={() => {}} notify={() => {}} />
    </BusinessProvider>,
  );
  await screen.findByText('First server page');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Second server page');
  assert.equal(urls.at(-1)!.searchParams.get('page'), '2');
  fireEvent.click(screen.getByRole('button', { name: /^Low stock$/ }));
  await waitFor(() => assert.equal(urls.at(-1)!.searchParams.get('status'), 'Low stock'));
  assert.equal(urls.at(-1)!.searchParams.get('page'), '1');
});

test('record retry keeps form values and reuses the request key after losing the response', async () => {
  const calls: { key: string | null; body: string }[] = [];
  globalThis.fetch = async (_url, options) => {
    calls.push({
      key: new Headers(options?.headers).get('Idempotency-Key'),
      body: String(options?.body),
    });
    if (calls.length === 1) throw new TypeError('Connection lost');
    return Response.json({ result: { id: 'created' }, patch: { data: {}, audit: [] } });
  };
  let done = false;
  render(
    <BusinessProvider live={live}>
      <RecordEditor
        kind="Sales"
        done={() => {
          done = true;
        }}
        notify={() => {}}
      />
    </BusinessProvider>,
  );
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: customerId } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const retry = await screen.findByRole('button', { name: 'Retry save' });
  assert.equal((screen.getByLabelText('Quantity') as HTMLInputElement).value, '3');
  assert.equal((screen.getByLabelText('Customer') as HTMLSelectElement).value, customerId);
  fireEvent.click(retry);
  await waitFor(() => assert.equal(done, true));
  assert.deepEqual(calls[0], calls[1]);
});

test('retrying a failed live table load keeps its search filter', async () => {
  window.history.replaceState(null, '', '#inventory?q=widget');
  const queries: string[] = [];
  globalThis.fetch = async (url) => {
    queries.push(new URL(String(url), 'http://localhost').searchParams.get('q') ?? '');
    if (queries.length === 1)
      return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
    return Response.json({ rows: live.data.products, total: 1, allTotal: 1 });
  };
  render(
    <BusinessProvider live={live}>
      <Records kind="Inventory" onSelect={() => {}} notify={() => {}} />
    </BusinessProvider>,
  );
  const retry = await screen.findByRole('button', { name: /^Retry$/ });
  fireEvent.click(retry);
  await screen.findByText('Real widget');
  assert.deepEqual(queries, ['widget', 'widget']);
  window.history.replaceState(null, '', '/');
});
