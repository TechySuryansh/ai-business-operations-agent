'use client';
import { useRef, useState } from 'react';
import { useBusiness, type BusinessRecord } from '@/lib/business-context';
import { Button } from '@/components/ui/button';
import type { RecordKind } from './records';
export function LiveRecordEditor({
  kind,
  record,
  done,
  notify,
}: {
  kind: RecordKind;
  record?: BusinessRecord;
  done: () => void;
  notify: (s: string) => void;
}) {
  const { data, execute, live } = useBusiness();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef({ value: crypto.randomUUID(), payload: '' });
  const [lines, setLines] = useState([
    { productId: data.products.find((p) => !p.archived)?.id ?? '', quantity: 1 },
  ]);
  const old = (record ?? {}) as unknown as Record<string, string | number>;
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(old).map(([k, v]) => [k, String(v)])),
  );
  const field = (label: string, name: string, type = 'text', required = true) => (
    <label className="field-label" key={name}>
      {label}
      <input
        type={type}
        value={form[name] ?? ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        required={required}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? '0.01' : undefined}
      />
    </label>
  );
  const select = (label: string, name: string, options: { value: string; label: string }[]) => (
    <label className="field-label">
      {label}
      <select
        value={form[name] ?? ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        required
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let action = '',
        payload: unknown;
      const base = record ? { id: record.id, version: record.version } : {};
      if (kind === 'Customers') {
        action = 'customer.save';
        payload = {
          ...base,
          name: form.name,
          contact: form.contact,
          email: form.email,
          location: form.location,
          status: form.status || 'Active',
        };
      } else if (kind === 'Inventory') {
        action = 'product.save';
        payload = {
          ...base,
          name: form.name,
          category: form.category,
          sku: form.sku,
          price: form.price,
          reorder: Number(form.reorder || 0),
          supplier: form.supplier,
          stock: Number(form.stock || 0),
          reason: form.reason,
          archived: form.archived === 'true',
        };
      } else if (kind === 'Sales') {
        action = record ? 'order.status' : 'order.create';
        payload = record
          ? { ...base, status: form.status }
          : { customerId: form.customerId, lines };
      } else if (!record) {
        action = 'invoice.create';
        payload = { orderId: form.orderId, due: form.due };
      } else {
        action = form.action || 'payment.create';
        payload = {
          ...base,
          amount: form.amount,
          reference: form.reference,
          paymentId: form.paymentId,
          reason: form.reason,
        };
      }
      const encoded = JSON.stringify([action, payload]);
      if (key.current.payload && key.current.payload !== encoded)
        key.current.value = crypto.randomUUID();
      key.current.payload = encoded;
      await execute(action, payload, key.current.value);
      notify('Changes saved to your company ledger.');
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="record-form">
      <p className="data-scope">
        Company ledger · USD · Server validates totals, stock and permissions.
      </p>
      <div className="form-grid">
        {kind === 'Customers' && (
          <>
            {field('Company name', 'name')}
            {field('Contact', 'contact')}
            {field('Email', 'email', 'email')}
            {field('Location', 'location')}
            {select(
              'Status',
              'status',
              ['Active', 'Inactive'].map((value) => ({ value, label: value })),
            )}
          </>
        )}
        {kind === 'Inventory' && (
          <>
            {field('Product name', 'name')}
            {field('Category', 'category')}
            {field('SKU', 'sku')}
            {field('Price (USD)', 'price', 'number')}
            {field('Stock quantity', 'stock', 'number')}
            {field('Reorder threshold', 'reorder', 'number')}
            {field('Supplier', 'supplier')}
            {field('Stock adjustment reason', 'reason', 'text', false)}
            {record &&
              select('Catalog status', 'archived', [
                { value: 'false', label: 'Active' },
                { value: 'true', label: 'Archived' },
              ])}
          </>
        )}
        {kind === 'Sales' && !record && (
          <>
            {select(
              'Customer',
              'customerId',
              data.customers
                .filter((c) => c.status === 'Active')
                .map((c) => ({ value: c.id, label: c.name })),
            )}
            <div className="record-form">
              {lines.map((line, index) => (
                <div className="line-item" key={index}>
                  <label className="field-label">
                    Product
                    <select
                      value={line.productId}
                      required
                      onChange={(e) =>
                        setLines(
                          lines.map((l, i) =>
                            i === index ? { ...l, productId: e.target.value } : l,
                          ),
                        )
                      }
                    >
                      {data.products
                        .filter((p) => !p.archived)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.stock} available · ${p.price}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Quantity
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((l, i) =>
                            i === index ? { ...l, quantity: Number(e.target.value) } : l,
                          ),
                        )
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setLines([...lines, { productId: data.products[0]?.id ?? '', quantity: 1 }])
                }
              >
                Add item
              </Button>
            </div>
          </>
        )}
        {kind === 'Sales' && record && (
          <>
            <p>
              Line items and prices are fixed after order creation. Cancellation restores stock for
              an uninvoiced processing order.
            </p>
            {select(
              'Next status',
              'status',
              (record && 'status' in record && record.status === 'Processing'
                ? ['Shipped', 'Cancelled']
                : ['Delivered']
              ).map((value) => ({ value, label: value })),
            )}
          </>
        )}
        {kind === 'Finance' && !record && (
          <>
            {select(
              'Order',
              'orderId',
              data.orders
                .filter(
                  (o) => o.status !== 'Cancelled' && !data.invoices.some((i) => i.orderId === o.id),
                )
                .map((o) => ({
                  value: o.id,
                  label: `${o.number ?? o.id} · ${o.customer} · $${o.amount}`,
                })),
            )}
            {field('Due date', 'due', 'date')}
          </>
        )}
        {kind === 'Finance' && record && (
          <>
            {select('Action', 'action', [
              { value: 'payment.create', label: 'Record manual payment' },
              { value: 'payment.reverse', label: 'Reverse payment' },
              { value: 'invoice.void', label: 'Void unpaid invoice' },
            ])}
            {(!form.action || form.action === 'payment.create') && (
              <>
                {field('Payment amount (USD)', 'amount', 'number')}
                {field('Payment reference', 'reference')}
              </>
            )}
            {form.action === 'payment.reverse' && (
              <>
                {select(
                  'Payment',
                  'paymentId',
                  ('payments' in record ? (record.payments ?? []) : [])
                    .filter((p) => !p.reversedAt)
                    .map((p) => ({ value: p.id, label: `${p.reference} · $${p.amount}` })),
                )}
                {field('Reversal reason', 'reason')}
              </>
            )}
            <p>Payments record an existing transaction. No bank account is charged.</p>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="callout amber">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="outline" onClick={done}>
          Cancel
        </Button>
        <Button disabled={busy || (live?.role === 'staff' && kind !== 'Customers')}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
