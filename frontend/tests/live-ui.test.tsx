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
test('live provider ignores browser demo records', () => {
  localStorage.setItem(
    'nexus-records-v1',
    JSON.stringify({ data: { customers: [{ name: 'Leaked demo' }] } }),
  );
  render(
    <BusinessProvider live={live}>
      <Records kind="Customers" onSelect={() => {}} notify={() => {}} />
    </BusinessProvider>,
  );
  assert.ok(screen.getByText('Real customer'));
  assert.equal(screen.queryByText('Leaked demo'), null);
});
test('live order form sends product quantities without trusting browser totals', async () => {
  const requests: { url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json(init?.method === 'POST' ? { id: 'created' } : live);
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
