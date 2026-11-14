'use client';
import { useState } from 'react';
import { Download, ArrowUpRight, Package, Users, ShoppingBag, Wallet } from 'lucide-react';
import { customers, invoices, orders, products } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Empty, SearchInput, StatusBadge } from '@/components/ui/shared';
import { date, downloadCSV, money, number } from '@/lib/utils';
import type { Module } from '@/types/business';
export type RecordKind = 'Customers' | 'Sales' | 'Inventory' | 'Finance';
export interface RecordSelection {
  kind: RecordKind;
  id: string;
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const source =
    kind === 'Customers'
      ? customers
      : kind === 'Sales'
        ? orders
        : kind === 'Inventory'
          ? products
          : invoices;
  const rows = source
    .filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
    .filter(
      (row) =>
        filter === 'All' ||
        ('status' in row
          ? row.status === filter
          : filter === 'Low stock'
            ? row.stock < row.reorder
            : row.stock >= row.reorder),
    );
  const filters =
    kind === 'Customers'
      ? ['All', 'Active', 'Inactive']
      : kind === 'Sales'
        ? ['All', 'Processing', 'Shipped', 'Delivered']
        : kind === 'Inventory'
          ? ['All', 'Healthy', 'Low stock']
          : ['All', 'Paid', 'Pending', 'Overdue'];
  const summaries =
    kind === 'Customers'
      ? [
          { label: 'Total customers', value: number(customers.length) },
          {
            label: 'Active relationships',
            value: number(customers.filter((c) => c.status === 'Active').length),
          },
          {
            label: 'Customer revenue · lifetime',
            value: money(customers.reduce((s, c) => s + c.revenue, 0)),
          },
        ]
      : kind === 'Sales'
        ? [
            { label: 'Recent order value', value: money(orders.reduce((s, o) => s + o.amount, 0)) },
            { label: 'Recent orders', value: number(orders.length) },
            {
              label: 'In progress',
              value: number(orders.filter((o) => o.status !== 'Delivered').length),
            },
          ]
        : kind === 'Inventory'
          ? [
              { label: 'Product lines', value: number(products.length) },
              { label: 'Units in stock', value: number(products.reduce((s, p) => s + p.stock, 0)) },
              {
                label: 'Below reorder level',
                value: number(products.filter((p) => p.stock < p.reorder).length),
              },
            ]
          : [
              {
                label: 'Outstanding balance',
                value: money(
                  invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0),
                ),
              },
              {
                label: 'Overdue balance',
                value: money(
                  invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
                ),
              },
              {
                label: 'Paid invoices',
                value: money(
                  invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
                ),
              },
            ];
  const Icon =
    kind === 'Customers'
      ? Users
      : kind === 'Sales'
        ? ShoppingBag
        : kind === 'Inventory'
          ? Package
          : Wallet;
  const exportRows = () => {
    downloadCSV(`technova-${kind.toLowerCase()}`, rows);
    notify(`${rows.length} ${kind.toLowerCase()} records exported as CSV.`);
  };
  return (
    <div className="module-stack">
      <div className="summary-grid">
        {summaries.map((s) => (
          <div className="panel summary-card" key={s.label}>
            <span>
              {s.label}
              <Icon size={16} />
            </span>
            <strong>{s.value}</strong>
            <small>TechNova · fictional demo data</small>
          </div>
        ))}
      </div>
      <section className="panel records-panel">
        <div className="records-toolbar">
          <div className="filter-tabs" aria-label={`${kind} status filters`}>
            {filters.map((f) => (
              <button
                aria-pressed={filter === f}
                className={filter === f ? 'active' : ''}
                key={f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={`Search ${kind.toLowerCase()}...`}
            />
            <Button variant="outline" onClick={exportRows}>
              <Download size={15} />
              Export
            </Button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(kind === 'Customers'
                  ? ['Customer', 'Contact', 'Location', 'Orders', 'Revenue', 'Status', '']
                  : kind === 'Sales'
                    ? ['Order', 'Customer', 'Date', 'Items', 'Amount', 'Status', '']
                    : kind === 'Inventory'
                      ? ['Product', 'SKU', 'Stock', 'Reorder at', 'Unit price', 'Status', '']
                      : ['Invoice', 'Customer', 'Issued', 'Due date', 'Amount', 'Status', '']
                ).map((h, i) => (
                  <th key={`${h}${i}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {'contact' in row ? (
                    <>
                      <td>
                        <button
                          className="customer-name record-link"
                          onClick={() => onSelect({ kind, id: row.id })}
                        >
                          <span className="small-avatar">
                            {row.name
                              .split(' ')
                              .map((w) => w[0])
                              .join('')}
                          </span>
                          <span>
                            {row.name}
                            <small>{row.id}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {row.contact}
                        <small>{row.email}</small>
                      </td>
                      <td>{row.location}</td>
                      <td>{row.orders}</td>
                      <td className="amount">{money(row.revenue)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </>
                  ) : 'sku' in row ? (
                    <>
                      <td>
                        <button
                          className="record-link"
                          onClick={() => onSelect({ kind, id: row.id })}
                        >
                          {row.name}
                        </button>
                        <small>{row.category}</small>
                      </td>
                      <td className="mono">{row.sku}</td>
                      <td className={row.stock < row.reorder ? 'low-stock' : ''}>
                        {row.stock} units
                      </td>
                      <td>{row.reorder} units</td>
                      <td className="amount">{money(row.price)}</td>
                      <td>
                        <StatusBadge status={row.stock < row.reorder ? 'Low stock' : 'Healthy'} />
                      </td>
                    </>
                  ) : 'items' in row ? (
                    <>
                      <td>
                        <button
                          className="record-link"
                          onClick={() => onSelect({ kind, id: row.id })}
                        >
                          {row.id}
                        </button>
                      </td>
                      <td>{row.customer}</td>
                      <td>{date(row.date)}</td>
                      <td>{row.items}</td>
                      <td className="amount">{money(row.amount)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <button
                          className="record-link"
                          onClick={() => onSelect({ kind, id: row.id })}
                        >
                          {row.id}
                        </button>
                      </td>
                      <td>{row.customer}</td>
                      <td>{date(row.issued)}</td>
                      <td>{date(row.due)}</td>
                      <td className="amount">{money(row.amount)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </>
                  )}
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
        {rows.length === 0 && <Empty />}
        <div className="table-footer">
          Showing {rows.length} of {source.length} sample records<span>All amounts in USD</span>
        </div>
      </section>
      <div className="demo-note">
        <span className="live-dot" />
        This workspace uses fictional sample data. Changes are saved only in this browser.
      </div>
    </div>
  );
}
export function RecordDetails({
  selection,
  navigate,
  close,
}: {
  selection: RecordSelection;
  navigate: (module: Module) => void;
  close: () => void;
}) {
  const source =
    selection.kind === 'Customers'
      ? customers
      : selection.kind === 'Sales'
        ? orders
        : selection.kind === 'Inventory'
          ? products
          : invoices;
  const record = source.find((r) => r.id === selection.id);
  if (!record) return <Empty />;
  return (
    <>
      <div className="detail-grid">
        {Object.entries(record).map(([key, value]) => (
          <div key={key}>
            <span>{key.replace(/([A-Z])/g, ' $1')}</span>
            <strong>
              {['amount', 'price', 'revenue'].includes(key) ? money(Number(value)) : String(value)}
            </strong>
          </div>
        ))}
      </div>
      {selection.kind === 'Inventory' && 'stock' in record && record.stock < record.reorder && (
        <div className="callout amber">
          This product is {record.reorder - record.stock} units below its reorder level. Review a
          simulated purchase draft in Automations.
        </div>
      )}
      <div className="dialog-actions">
        <Button variant="outline" onClick={close}>
          Close
        </Button>
        <Button
          onClick={() => {
            close();
            navigate(
              selection.kind === 'Customers'
                ? 'Sales'
                : selection.kind === 'Sales'
                  ? 'Finance'
                  : 'Automations',
            );
          }}
        >
          {selection.kind === 'Customers'
            ? 'Browse recent orders'
            : selection.kind === 'Sales'
              ? 'Browse invoices'
              : 'View automations'}
          <ArrowUpRight size={15} />
        </Button>
      </div>
    </>
  );
}
