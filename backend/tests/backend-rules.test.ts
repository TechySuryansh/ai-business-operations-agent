import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorize,
  moneyInput,
  orderInput,
  orderTransition,
  today,
  dateInput,
} from '../src/server/rules';
import { getMetrics } from '../src/server/metrics';
test('roles deny staff financial writes and managers company administration', () => {
  assert.doesNotThrow(() => authorize('staff', 'customer'));
  assert.throws(() => authorize('staff', 'operate'));
  assert.throws(() => authorize('manager', 'admin'));
  assert.throws(() => authorize('unknown', 'read'));
  assert.doesNotThrow(() => authorize('owner', 'admin'));
});
test('financial input rejects excess precision, negatives, and invalid dates', () => {
  for (const input of ['-1', '1.001', 'NaN', '1e4'])
    assert.equal(moneyInput.safeParse(input).success, false);
  assert.equal(moneyInput.parse('10.25'), '10.25');
  assert.equal(dateInput.safeParse('2026-02-30').success, false);
  assert.equal(orderInput.safeParse({ customerId: crypto.randomUUID(), lines: [] }).success, false);
});
test('order lifecycle forbids repeated cancellations and backward transitions', () => {
  assert.doesNotThrow(() => orderTransition('Processing', 'Cancelled'));
  assert.throws(() => orderTransition('Cancelled', 'Cancelled'));
  assert.throws(() => orderTransition('Delivered', 'Processing'));
});
test('company date observes timezone boundaries', () => {
  const now = new Date('2026-11-16T00:30:00Z');
  assert.equal(today('America/New_York', now), '2026-11-15');
  assert.equal(today('Asia/Kolkata', now), '2026-11-16');
});
test('live metrics use actual periods, partial payments and exclude voids', () => {
  const result = getMetrics(7, {
    live: true,
    dailySales: Array.from({ length: 14 }, (_, i) => ({
      day: String(i),
      revenue: i < 7 ? 10 : 20,
      previous: 999,
      orders: 1,
    })),
    customers: [],
    products: [],
    invoices: [
      { status: 'Pending', amount: 100, outstanding: 25 },
      { status: 'Void', amount: 500, outstanding: 500 },
    ],
  });
  assert.equal(result.revenue, 140);
  assert.equal(result.growth, '100.0');
  assert.equal(result.outstanding, 25);
});
