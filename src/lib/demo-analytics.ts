// Pure, deterministic mock calculations. A future data service can replace these inputs.
import { dailySales, invoices, products, customers } from '@/data/mock-data';
export function getMetrics(days = 14) {
  const current = dailySales.slice(-days);
  const revenue = current.reduce((sum, day) => sum + day.revenue, 0);
  const previous = current.reduce((sum, day) => sum + day.previous, 0);
  return {
    revenue,
    growth: (((revenue - previous) / previous) * 100).toFixed(1),
    orders: current.reduce((sum, day) => sum + day.orders, 0),
    outstanding: invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0),
    lowStock: products.filter((p) => p.stock < p.reorder).length,
    activeCustomers: customers.filter((c) => c.status === 'Active').length,
  };
}
