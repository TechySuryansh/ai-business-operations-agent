// Pure, deterministic mock calculations. A future data service can replace these inputs.
import type { BusinessData } from './business-context';
import { dailySales, invoices, products, customers } from '@/data/mock-data';
export function getMetrics(
  days = 14,
  data: {
    invoices: { status: string; amount: number; outstanding?: number }[];
    products: { stock: number; reorder: number }[];
    customers: { status: string }[];
    dailySales?: BusinessData['dailySales'];
    live?: boolean;
  } = { invoices, products, customers },
) {
  const { invoices: ledger, products: catalog, customers: accounts } = data;
  const series = data.dailySales ?? dailySales;
  const current = series.slice(-days);
  const revenue = current.reduce((sum, day) => sum + day.revenue, 0);
  const previous = data.live
    ? series.slice(-days * 2, -days).reduce((sum, day) => sum + day.revenue, 0)
    : current.reduce((sum, day) => sum + day.previous, 0);
  return {
    revenue,
    growth: previous ? (((revenue - previous) / previous) * 100).toFixed(1) : '—',
    orders: current.reduce((sum, day) => sum + day.orders, 0),
    outstanding: ledger
      .filter((i) => i.status !== 'Paid' && i.status !== 'Void')
      .reduce((s, i) => s + (i.outstanding ?? i.amount), 0),
    lowStock: catalog.filter((p) => p.stock < p.reorder).length,
    overdue: ledger.filter((i) => i.status === 'Overdue').length,
    inactiveCustomers: accounts.filter((c) => c.status === 'Inactive').length,
    activeCustomers: accounts.filter((c) => c.status === 'Active').length,
  };
}
