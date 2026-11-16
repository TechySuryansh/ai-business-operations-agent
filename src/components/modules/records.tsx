'use client';
import { useEffect, useState } from 'react';
import { Download, ArrowUpRight, Plus, Pencil, Save, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty, SearchInput, StatusBadge } from '@/components/ui/shared';
import { date, downloadCSV, money, number } from '@/lib/utils';
import {
  useBusiness,
  exportName,
  snapshotDate,
  type BusinessRecord,
  type Collection,
} from '@/lib/business-context';
import type { Module, Customer, Product, Order, Invoice } from '@/types/business';
export type RecordKind = 'Customers' | 'Sales' | 'Inventory' | 'Finance';
export interface RecordSelection {
  kind: RecordKind;
  id: string;
}
type Row = BusinessRecord;
type Field = {
  key: string;
  label: string;
  type?: 'number' | 'date' | 'email' | 'select';
  options?: string[];
  min?: number;
  integer?: boolean;
};
export const collection: Record<RecordKind, Collection> = {
  Customers: 'customers',
  Sales: 'orders',
  Inventory: 'products',
  Finance: 'invoices',
};
const titles: Record<RecordKind, string> = {
  Customers: 'customer',
  Sales: 'order',
  Inventory: 'product',
  Finance: 'invoice',
};
const statuses: Record<RecordKind, string[]> = {
  Customers: ['All', 'Active', 'Inactive'],
  Sales: ['All', 'Processing', 'Shipped', 'Delivered'],
  Inventory: ['All', 'Healthy', 'Low stock'],
  Finance: ['All', 'Paid', 'Pending', 'Overdue'],
};
const columns: Record<RecordKind, { key: string; label: string }[]> = {
  Customers: [
    { key: 'name', label: 'Customer' },
    { key: 'contact', label: 'Contact' },
    { key: 'location', label: 'Location' },
    { key: 'orders', label: 'Orders' },
    { key: 'revenue', label: 'Lifetime revenue' },
    { key: 'status', label: 'Status' },
  ],
  Sales: [
    { key: 'id', label: 'Order' },
    { key: 'customer', label: 'Customer' },
    { key: 'date', label: 'Date' },
    { key: 'items', label: 'Items' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ],
  Inventory: [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'stock', label: 'Stock' },
    { key: 'reorder', label: 'Reorder at' },
    { key: 'price', label: 'Unit price' },
    { key: 'status', label: 'Status' },
  ],
  Finance: [
    { key: 'id', label: 'Invoice' },
    { key: 'customer', label: 'Customer' },
    { key: 'issued', label: 'Issued' },
    { key: 'due', label: 'Due date' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ],
};
const fieldLabels: Record<string, string> = {
  id: 'Record ID',
  name: 'Name',
  contact: 'Contact name',
  email: 'Email address',
  location: 'Location',
  revenue: 'Lifetime sample revenue',
  orders: 'Lifetime sample orders',
  lastOrder: 'Last historical order',
  status: 'Status',
  category: 'Category',
  sku: 'SKU',
  stock: 'Stock quantity',
  reorder: 'Reorder threshold',
  price: 'Unit price',
  sold: 'Lifetime units sold',
  supplier: 'Supplier',
  customer: 'Customer',
  date: 'Order date',
  items: 'Item quantity',
  amount: 'Amount',
  issued: 'Issue date',
  due: 'Due date',
};
const raw = (row: Row, key: string): string | number =>
  key === 'status' && 'stock' in row
    ? row.stock < row.reorder
      ? 'Low stock'
      : 'Healthy'
    : ((row as unknown as Record<string, string | number>)[key] ?? '');
const formatted = (row: Row, key: string) =>
  key === 'lastOrder' && 'orders' in row && row.orders === 0
    ? 'No historical orders'
    : ['amount', 'price', 'revenue'].includes(key)
      ? money(Number(raw(row, key)))
      : ['date', 'issued', 'due', 'lastOrder'].includes(key)
        ? date(String(raw(row, key)))
        : String(raw(row, key));
interface View {
  q: string;
  status: string;
  sort: string;
  direction: 'asc' | 'desc';
  size: number;
  hidden: string[];
}
const defaultView: View = {
  q: '',
  status: 'All',
  sort: '',
  direction: 'asc',
  size: 10,
  hidden: [],
};
function viewFromURL(kind: RecordKind): View {
  if (typeof window === 'undefined') return defaultView;
  const [module, query] = window.location.hash.slice(1).split('?');
  if (module !== kind.toLowerCase()) return defaultView;
  const p = new URLSearchParams(query);
  const sort = p.get('sort') ?? '';
  return {
    ...defaultView,
    q: p.get('q') ?? '',
    status: statuses[kind].includes(p.get('status') ?? '') ? p.get('status')! : 'All',
    sort: columns[kind].some((c) => c.key === sort) ? sort : '',
    direction: p.get('direction') === 'desc' ? 'desc' : 'asc',
    size: [5, 10, 25, 50].includes(Number(p.get('size'))) ? Number(p.get('size')) : 10,
    hidden: (p.get('hidden') ?? '')
      .split(',')
      .filter((k) => columns[kind].slice(1).some((c) => c.key === k)),
  };
}
export function Records({
  kind,
  onSelect,
  notify,
}: {
  kind: RecordKind;
  onSelect: (record: RecordSelection) => void;
  notify: (message: string) => void;
}) {
  const { data, companyName } = useBusiness();
  const source: Row[] = data[collection[kind]];
  const [view, setView] = useState<View>(defaultView);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState(false);
  const [saved, setSaved] = useState<{ name: string; view: View }[]>([]);
  const [viewName, setViewName] = useState('');
  useEffect(() => {
    const read = () => {
      setView(viewFromURL(kind));
      setPage(
        Math.max(
          1,
          Math.floor(
            Number(new URLSearchParams(window.location.hash.split('?')[1]).get('page')) || 1,
          ),
        ),
      );
      setSelected([]);
    };
    read();
    window.addEventListener('hashchange', read);
    try {
      const parsed = JSON.parse(localStorage.getItem(`nexus-views-${kind}`) ?? '[]');
      if (Array.isArray(parsed))
        setSaved(
          parsed
            .filter(
              (v) =>
                typeof v?.name === 'string' &&
                v.view &&
                typeof v.view.q === 'string' &&
                statuses[kind].includes(v.view.status) &&
                ['asc', 'desc'].includes(v.view.direction) &&
                [5, 10, 25, 50].includes(v.view.size) &&
                Array.isArray(v.view.hidden) &&
                v.view.hidden.every((k: unknown) => typeof k === 'string') &&
                typeof v.view.sort === 'string',
            )
            .slice(0, 10),
        );
    } catch {
      notify('Saved views could not be loaded.');
    }
    return () => window.removeEventListener('hashchange', read);
  }, [kind, notify]);
  const change = (next: Partial<View>) => {
    const value = { ...view, ...next };
    setView(value);
    setPage(1);
    setSelected([]);
    if (window.location.hash.slice(1).split('?')[0] === kind.toLowerCase()) {
      const p = new URLSearchParams(window.location.hash.split('?')[1]);
      p.delete('page');
      for (const [key, v] of Object.entries({
        q: value.q,
        status: value.status === 'All' ? '' : value.status,
        sort: value.sort,
        direction: value.direction,
        size: String(value.size),
        hidden: value.hidden.join(','),
      }))
        v ? p.set(key, v) : p.delete(key);
      window.history.replaceState(null, '', `#${kind.toLowerCase()}${p.size ? `?${p}` : ''}`);
    }
  };
  const rows = source
    .filter((row) => Object.values(row).join(' ').toLowerCase().includes(view.q.toLowerCase()))
    .filter((row) => view.status === 'All' || raw(row, 'status') === view.status)
    .sort((a, b) => {
      if (!view.sort) return 0;
      const x = raw(a, view.sort),
        y = raw(b, view.sort);
      return (
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true })) *
        (view.direction === 'asc' ? 1 : -1)
      );
    });
  const goPage = (next: number) => {
    setPage(next);
    const [slug, query] = window.location.hash.slice(1).split('?');
    if (slug === kind.toLowerCase()) {
      const p = new URLSearchParams(query);
      p.set('page', String(next));
      window.history.replaceState(null, '', `#${slug}?${p}`);
    }
  };
  const totalPages = Math.max(1, Math.ceil(rows.length / view.size));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * view.size, currentPage * view.size);
  const shownColumns = columns[kind].filter((c, i) => i === 0 || !view.hidden.includes(c.key));
  const summaries =
    kind === 'Customers'
      ? [
          { label: 'Customers', value: number(data.customers.length) },
          {
            label: 'Active accounts',
            value: number(data.customers.filter((c) => c.status === 'Active').length),
          },
          {
            label: 'Lifetime sample revenue',
            value: money(data.customers.reduce((s, c) => s + c.revenue, 0)),
          },
        ]
      : kind === 'Sales'
        ? [
            {
              label: 'Local order value',
              value: money(data.orders.reduce((s, o) => s + o.amount, 0)),
            },
            { label: 'Local orders', value: number(data.orders.length) },
            {
              label: 'In progress',
              value: number(data.orders.filter((o) => o.status !== 'Delivered').length),
            },
          ]
        : kind === 'Inventory'
          ? [
              { label: 'Product lines', value: number(data.products.length) },
              {
                label: 'Units in stock',
                value: number(data.products.reduce((s, p) => s + p.stock, 0)),
              },
              {
                label: 'Below reorder level',
                value: number(data.products.filter((p) => p.stock < p.reorder).length),
              },
            ]
          : [
              {
                label: 'Outstanding balance',
                value: money(
                  data.invoices
                    .filter((i) => i.status !== 'Paid')
                    .reduce((s, i) => s + i.amount, 0),
                ),
              },
              {
                label: 'Overdue balance',
                value: money(
                  data.invoices
                    .filter((i) => i.status === 'Overdue')
                    .reduce((s, i) => s + i.amount, 0),
                ),
              },
              {
                label: 'Paid invoice value',
                value: money(
                  data.invoices
                    .filter((i) => i.status === 'Paid')
                    .reduce((s, i) => s + i.amount, 0),
                ),
              },
            ];
  const exportRows = () => {
    try {
      const exportable = selected.length ? rows.filter((r) => selected.includes(r.id)) : rows;
      downloadCSV(`${exportName(companyName)}-${kind.toLowerCase()}`, exportable);
      notify(`${exportable.length} records exported as CSV.`);
    } catch {
      notify('Export failed. Please try again.');
    }
  };
  const persistViews = (next: typeof saved) => {
    setSaved(next);
    try {
      localStorage.setItem(`nexus-views-${kind}`, JSON.stringify(next));
      notify('Saved views updated.');
    } catch {
      notify('Saved views could not be stored on this device.');
    }
  };
  return (
    <div className="module-stack">
      <div className="summary-grid">
        {summaries.map((s) => (
          <div className="panel summary-card" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{companyName} · local demo ledger</small>
          </div>
        ))}
      </div>
      <section className="panel records-panel" aria-label={`${kind} records`}>
        <div className="records-toolbar">
          <div className="filter-tabs" role="group" aria-label={`${kind} status filters`}>
            {statuses[kind].map((f) => (
              <button
                aria-pressed={view.status === f}
                className={view.status === f ? 'active' : ''}
                key={f}
                onClick={() => change({ status: f })}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <SearchInput
              value={view.q}
              onChange={(q) => change({ q })}
              placeholder={`Search ${kind.toLowerCase()}...`}
            />
            <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
              <Download size={15} />
              {selected.length ? `Export ${selected.length} selected` : 'Export'}
            </Button>
            <Button onClick={() => setEditor(true)}>
              <Plus size={15} />
              Add {titles[kind]}
            </Button>
          </div>
        </div>
        <div className="table-options">
          <details>
            <summary>Columns</summary>
            <div className="column-options">
              {columns[kind].slice(1).map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={!view.hidden.includes(c.key)}
                    onChange={() =>
                      change({
                        hidden: view.hidden.includes(c.key)
                          ? view.hidden.filter((k) => k !== c.key)
                          : [...view.hidden, c.key],
                      })
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </details>
          <label>
            Saved views{' '}
            <select
              aria-label="Load saved view"
              value=""
              onChange={(e) => {
                const found = saved.find((v) => v.name === e.target.value);
                if (found) change(found.view);
              }}
            >
              <option value="">Choose a view</option>
              {saved.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = viewName.trim();
              if (!name) return;
              persistViews([...saved.filter((v) => v.name !== name), { name, view }].slice(-10));
              setViewName('');
            }}
          >
            <input
              aria-label="Saved view name"
              placeholder="Name this view"
              value={viewName}
              maxLength={40}
              onChange={(e) => setViewName(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={!viewName.trim()}>
              <Save size={14} />
              Save view
            </Button>
          </form>
          {saved.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => persistViews([])}>
              Clear saved views
            </Button>
          )}
          {(view.q || view.status !== 'All' || view.hidden.length > 0 || view.sort) && (
            <Button variant="ghost" size="sm" onClick={() => change(defaultView)}>
              Reset filters
            </Button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{kind} · current local records · amounts in USD</caption>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select visible records"
                    checked={
                      visibleRows.length > 0 && visibleRows.every((r) => selected.includes(r.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? Array.from(new Set([...selected, ...visibleRows.map((r) => r.id)]))
                          : selected.filter((id) => !visibleRows.some((r) => r.id === id)),
                      )
                    }
                  />
                </th>
                {shownColumns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      view.sort === c.key
                        ? view.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      className="sort-button"
                      onClick={() =>
                        change({
                          sort: c.key,
                          direction:
                            view.sort === c.key && view.direction === 'asc' ? 'desc' : 'asc',
                        })
                      }
                    >
                      {c.label}
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                ))}
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.id}`}
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, row.id]
                            : selected.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  {shownColumns.map((c, i) => (
                    <td
                      key={c.key}
                      className={['amount', 'price', 'revenue'].includes(c.key) ? 'amount' : ''}
                    >
                      {i === 0 ? (
                        <>
                          <button
                            className="record-link"
                            onClick={() => onSelect({ kind, id: row.id })}
                          >
                            {formatted(row, c.key)}
                          </button>
                          {'category' in row && <small>{row.category}</small>}
                          {'contact' in row && <small>{row.id}</small>}
                        </>
                      ) : c.key === 'status' ? (
                        <StatusBadge status={String(raw(row, 'status'))} />
                      ) : (
                        <>
                          {formatted(row, c.key)}
                          {c.key === 'contact' && 'email' in row && <small>{row.email}</small>}
                        </>
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${row.id}`}
                      onClick={() => onSelect({ kind, id: row.id })}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
        <div className="table-footer">
          <span role="status">
            {rows.length
              ? `${(currentPage - 1) * view.size + 1}–${Math.min(currentPage * view.size, rows.length)}`
              : '0'}{' '}
            of {rows.length} matching records ({source.length} total)
            {selected.length > 0 ? ` · ${selected.length} selected` : ''}
          </span>
          <div className="pagination">
            <label>
              Rows{' '}
              <select
                aria-label="Rows per page"
                value={view.size}
                onChange={(e) => change({ size: Number(e.target.value) })}
              >
                {[5, 10, 25, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => goPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => goPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      <p className="demo-note">
        Edits are saved on this device. Historical daily analytics and lifetime samples are separate
        from this local ledger. All amounts are in USD.
      </p>
      <Dialog
        open={editor}
        onOpenChange={setEditor}
        title={`Add ${titles[kind]}`}
        description="Create a local demo record. No external business action occurs."
      >
        {editor && <RecordEditor kind={kind} done={() => setEditor(false)} notify={notify} />}
      </Dialog>
    </div>
  );
}
export function RecordEditor({
  kind,
  record,
  done,
  notify,
}: {
  kind: RecordKind;
  record?: Row;
  done: () => void;
  notify: (message: string) => void;
}) {
  const { data, save } = useBusiness();
  const fields: Field[] =
    kind === 'Customers'
      ? [
          { key: 'name', label: 'Company name' },
          { key: 'contact', label: 'Contact name' },
          { key: 'email', label: 'Email address', type: 'email' },
          { key: 'location', label: 'Location' },
          { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
        ]
      : kind === 'Inventory'
        ? [
            { key: 'name', label: 'Product name' },
            { key: 'sku', label: 'SKU' },
            { key: 'category', label: 'Category' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'stock', label: 'Stock quantity', type: 'number', integer: true },
            { key: 'reorder', label: 'Reorder threshold', type: 'number', integer: true },
            { key: 'price', label: 'Unit price (USD)', type: 'number' },
          ]
        : kind === 'Sales'
          ? [
              {
                key: 'customer',
                label: 'Customer',
                type: 'select',
                options: data.customers.map((c) => c.name),
              },
              { key: 'date', label: 'Order date', type: 'date' },
              { key: 'items', label: 'Item quantity', type: 'number', min: 1, integer: true },
              { key: 'amount', label: 'Order amount (USD)', type: 'number', min: 0.01 },
              {
                key: 'status',
                label: 'Status',
                type: 'select',
                options: ['Processing', 'Shipped', 'Delivered'],
              },
            ]
          : [
              {
                key: 'customer',
                label: 'Customer',
                type: 'select',
                options: data.customers.map((c) => c.name),
              },
              { key: 'issued', label: 'Issue date', type: 'date' },
              { key: 'due', label: 'Due date', type: 'date' },
              { key: 'amount', label: 'Invoice amount (USD)', type: 'number', min: 0.01 },
              {
                key: 'status',
                label: 'Status',
                type: 'select',
                options: ['Pending', 'Overdue', 'Paid'],
              },
            ];
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        record
          ? String(raw(record, f.key))
          : f.type === 'select'
            ? f.options![0]
            : f.type === 'date'
              ? snapshotDate
              : f.type === 'number'
                ? '0'
                : '',
      ]),
    ),
  );
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (fields.some((f) => !form[f.key]?.trim())) {
      setError('Complete every required field.');
      return;
    }
    for (const f of fields)
      if (
        f.type === 'number' &&
        (!Number.isFinite(Number(form[f.key])) ||
          Number(form[f.key]) < (f.min ?? 0) ||
          (f.integer && !Number.isInteger(Number(form[f.key]))))
      ) {
        setError(`Enter a valid ${f.label.toLowerCase()}.`);
        return;
      }
    if (kind === 'Finance' && form.due < form.issued) {
      setError('Due date must be on or after the issue date.');
      return;
    }
    if (
      kind === 'Finance' &&
      form.status !== 'Paid' &&
      form.due < snapshotDate !== (form.status === 'Overdue')
    ) {
      setError(
        'Choose Overdue for an unpaid invoice due before November 14, 2026; otherwise choose Pending.',
      );
      return;
    }
    if (
      kind === 'Customers' &&
      data.customers.some(
        (c) => c.id !== record?.id && c.name.toLowerCase() === form.name.trim().toLowerCase(),
      )
    ) {
      setError('A customer with this company name already exists.');
      return;
    }
    if (
      kind === 'Inventory' &&
      data.products.some(
        (p) => p.id !== record?.id && p.sku.toLowerCase() === form.sku.trim().toLowerCase(),
      )
    ) {
      setError('This SKU already exists. Use a unique SKU.');
      return;
    }
    const prefix = { Customers: 'CUS', Sales: 'ORD', Inventory: 'PRD', Finance: 'INV' }[kind];
    const defaults =
      kind === 'Customers'
        ? { orders: 0, revenue: 0, lastOrder: snapshotDate }
        : kind === 'Inventory'
          ? { sold: 0, revenue: 0 }
          : {};
    const updated = {
      ...defaults,
      ...record,
      id: record?.id ?? `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      ...Object.fromEntries(
        fields.map((f) => [f.key, f.type === 'number' ? Number(form[f.key]) : form[f.key].trim()]),
      ),
    } as Row;
    save(
      collection[kind],
      updated,
      `${record ? 'Updated' : 'Created'} ${titles[kind]} ${updated.id}${'name' in updated ? ` · ${updated.name}` : ''}${kind === 'Inventory' && record && 'stock' in record && 'stock' in updated ? ` · stock ${record.stock} → ${updated.stock}` : ''}`,
    );
    notify(`${titles[kind][0].toUpperCase() + titles[kind].slice(1)} saved locally.`);
    done();
  };
  return (
    <form onSubmit={submit} className="record-form">
      <p className="data-scope">
        Local demo ledger. Dates and overdue states use the November 14, 2026 snapshot. Historical
        totals are preserved.
      </p>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key} className="field-label">
            {f.label}
            {f.type === 'select' ? (
              <select
                required
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              >
                {f.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                required
                maxLength={f.type === 'number' || f.type === 'date' ? undefined : 100}
                type={f.type ?? 'text'}
                min={f.type === 'number' ? (f.min ?? 0) : undefined}
                step={f.type === 'number' ? (f.integer ? '1' : '0.01') : undefined}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="outline" onClick={done}>
          Cancel
        </Button>
        <Button type="submit">
          <Save size={15} />
          Save {titles[kind]}
        </Button>
      </div>
    </form>
  );
}
export function RecordDetails({
  selection,
  navigate,
  close,
}: {
  selection: RecordSelection;
  navigate: (module: Module, query?: string) => void;
  close: () => void;
}) {
  const { data, audit, save, formatTime } = useBusiness();
  const [editing, setEditing] = useState(false);
  const [payment, setPayment] = useState(false);
  const [feedback, setFeedback] = useState('');
  const record: Row | undefined = data[collection[selection.kind]].find(
    (r) => r.id === selection.id,
  );
  if (!record) return <Empty />;
  if (editing)
    return (
      <RecordEditor
        kind={selection.kind}
        record={record}
        notify={setFeedback}
        done={() => setEditing(false)}
      />
    );
  const name = 'name' in record ? record.name : record.customer;
  const relatedOrders = data.orders.filter((o) => o.customer === name);
  const relatedInvoices = data.invoices.filter((i) => i.customer === name);
  const customer = data.customers.find((c) => c.name === name);
  const openRelated = (kind: RecordKind, id: string) => {
    close();
    navigate(kind, `id=${encodeURIComponent(id)}`);
  };
  const keys =
    selection.kind === 'Customers'
      ? ['id', 'contact', 'email', 'location', 'status', 'lastOrder', 'orders', 'revenue']
      : selection.kind === 'Inventory'
        ? ['id', 'sku', 'category', 'supplier', 'stock', 'reorder', 'price', 'sold', 'revenue']
        : selection.kind === 'Sales'
          ? ['id', 'customer', 'date', 'items', 'amount', 'status']
          : ['id', 'customer', 'issued', 'due', 'amount', 'status'];
  const history = audit.filter((e) => e.message.includes(record.id) || e.message.includes(name));
  return (
    <div className="record-detail">
      <div className="record-detail-heading">
        <h3>{'name' in record ? record.name : record.id}</h3>
        <StatusBadge status={String(raw(record, 'status'))} />
      </div>
      <div className="detail-grid">
        {keys.map((key) => (
          <div key={key}>
            <span>{fieldLabels[key] ?? key}</span>
            <strong>{formatted(record, key)}</strong>
          </div>
        ))}
      </div>
      {selection.kind === 'Inventory' && 'stock' in record && record.stock < record.reorder && (
        <div className="callout amber">
          {record.reorder - record.stock} units below the reorder level. Adjust stock below or
          prepare a purchase draft in Automations.
        </div>
      )}
      {customer && selection.kind !== 'Customers' && (
        <button className="text-link" onClick={() => openRelated('Customers', customer.id)}>
          Open {customer.name}
          <ArrowUpRight size={14} />
        </button>
      )}
      {selection.kind !== 'Inventory' && (
        <div className="related-records">
          <h3>
            {selection.kind === 'Customers'
              ? 'Orders & invoices'
              : 'Other records for this customer'}
          </h3>
          <p className="data-scope">
            Linked by customer. An invoice is not assumed to belong to a specific order.
          </p>
          {relatedOrders
            .filter((o) => o.id !== record.id)
            .map((o) => (
              <button key={o.id} onClick={() => openRelated('Sales', o.id)}>
                <span>
                  {o.id} · {date(o.date)}
                </span>
                <strong>{money(o.amount)}</strong>
                <StatusBadge status={o.status} />
              </button>
            ))}
          {relatedInvoices
            .filter((i) => i.id !== record.id)
            .map((i) => (
              <button key={i.id} onClick={() => openRelated('Finance', i.id)}>
                <span>
                  {i.id} · due {date(i.due)}
                </span>
                <strong>{money(i.amount)}</strong>
                <StatusBadge status={i.status} />
              </button>
            ))}
          {relatedOrders.length + relatedInvoices.length === 0 && (
            <p>No related local records yet.</p>
          )}
        </div>
      )}
      <div className="local-audit">
        <h3>Record activity</h3>
        <p>Original sample · Nov 14, 2026 snapshot</p>
        {history.map((e) => (
          <p key={e.id}>
            <time dateTime={e.at}>{formatTime(e.at)}</time> · {e.message}
          </p>
        ))}
      </div>
      {feedback && <p role="status">{feedback}</p>}
      {payment && 'due' in record && (
        <div className="callout">
          <p>
            Record a full payment of {money(record.amount)} for {record.id}? This updates the local
            invoice only.
          </p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setPayment(false)}>
              Cancel payment
            </Button>
            <Button
              onClick={() => {
                save(
                  'invoices',
                  { ...record, status: 'Paid' },
                  `Recorded full payment for ${record.id} · ${money(record.amount)}`,
                );
                setPayment(false);
                setFeedback('Payment recorded locally.');
              }}
            >
              Confirm payment
            </Button>
          </div>
        </div>
      )}
      <div className="dialog-actions">
        <Button variant="outline" onClick={close}>
          Close
        </Button>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil size={14} />
          {selection.kind === 'Inventory'
            ? 'Edit product / adjust stock'
            : `Edit ${titles[selection.kind]}`}
        </Button>
        {'due' in record && record.status !== 'Paid' && (
          <Button onClick={() => setPayment(true)}>Record payment</Button>
        )}
        {selection.kind === 'Inventory' && (
          <Button
            onClick={() => {
              close();
              navigate('Automations');
            }}
          >
            Prepare purchase draft
          </Button>
        )}
      </div>
    </div>
  );
}
