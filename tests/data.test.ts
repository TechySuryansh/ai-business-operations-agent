import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMetrics } from '../src/lib/demo-analytics';
import { answer } from '../src/lib/demo-assistant';
import { invoices, products, orders, customers } from '../src/data/mock-data';
import { createReportBlob } from '../src/lib/report-export';
import ExcelJS from 'exceljs';
test('dashboard calculates the independently summed daily revenue and order totals', () => {
  const m = getMetrics();
  assert.equal(m.revenue, 136900);
  assert.equal(m.orders, 305);
  assert.equal(m.outstanding, 29340);
  assert.equal(m.lowStock, 3);
  assert.equal(m.activeCustomers, 5);
});
test('date selection changes the aggregate to the final seven days', () => {
  const m = getMetrics(7);
  assert.equal(m.revenue, 79900);
  assert.equal(m.orders, 177);
  assert.ok(Number(m.growth) > 0);
});
test('sample records reference valid customers and have unique identifiers', () => {
  const names = new Set(customers.map((c) => c.name));
  for (const r of [...orders, ...invoices]) assert.ok(names.has(r.customer));
  for (const records of [customers, products, orders, invoices])
    assert.equal(new Set(records.map((r) => r.id)).size, records.length);
});
test('assistant overdue totals agree with the invoice ledger', () => {
  const response = answer('Show overdue invoices');
  assert.match(response.text, /\$17,850/);
  assert.match(response.text, /\$29,340/);
  assert.equal(response.module, 'Finance');
});
test('assistant inventory response only lists products below the reorder threshold', () => {
  const response = answer('Which products need restocking?');
  assert.match(response.text, /3 products/);
  assert.match(response.text, /Keychron/);
  assert.doesNotMatch(response.text, /MacBook/);
  assert.equal(response.module, 'Inventory');
});
test('unsupported assistant questions explain demo limitations', () => {
  assert.match(answer('What is the weather?').text, /not connected/);
});
test('Excel export is a readable workbook with the actual source records', async () => {
  const blob = await createReportBlob('inventory', products, 'xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet = workbook.getWorksheet(1)!;
  assert.equal(sheet.rowCount, products.length + 1);
  assert.equal(sheet.getCell('B2').value, products[0].name);
  assert.equal(sheet.getCell('E2').value, products[0].stock);
});
test('PDF export produces an actual PDF document', async () => {
  const blob = await createReportBlob('sales', orders, 'pdf');
  assert.equal(blob.type, 'application/pdf');
  assert.match(await blob.slice(0, 20).text(), /^%PDF-/);
  assert.ok(blob.size > 2000);
});

test('local ledger metrics reflect payments and stock changes without rewriting historical revenue', () => {
  const data = {
    customers,
    products: products.map((p) => ({ ...p, stock: p.reorder })),
    invoices: invoices.map((i) => ({ ...i, status: 'Paid' as const })),
  };
  const m = getMetrics(7, data);
  assert.equal(m.revenue, 79900);
  assert.equal(m.outstanding, 0);
  assert.equal(m.overdue, 0);
  assert.equal(m.lowStock, 0);
});

test('currency retains cents and abbreviates compact amounts', async () => {
  const { money } = await import('../src/lib/utils');
  assert.equal(money(123.45), '$123.45');
  assert.equal(money(123), '$123');
  assert.equal(money(1200, true), '$1.2K');
});

test('persisted business data rejects invalid quantities, statuses and customer references', async () => {
  const { validData, initialData } = await import('../src/lib/business-context');
  assert.ok(validData(initialData));
  assert.equal(
    validData({ ...initialData, products: products.map((p) => ({ ...p, stock: -1 })) }),
    false,
  );
  assert.equal(
    validData({
      ...initialData,
      orders: orders.map((o) => ({ ...o, customer: 'Missing customer' })),
    }),
    false,
  );
  assert.equal(
    validData({ ...initialData, invoices: invoices.map((i) => ({ ...i, status: 'Unknown' })) }),
    false,
  );
});
