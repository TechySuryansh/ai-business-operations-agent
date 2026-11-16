// Local intent matching only: no LLM or remote integration.
import { customers, invoices, products } from '@/data/mock-data';
import type { BusinessData } from './business-context';
import { getMetrics } from './demo-analytics';
import { money } from './utils';
import type { Module } from '@/types/business';
export function answer(
  prompt: string,
  days = 14,
  data: BusinessData = { customers, products, invoices, orders: [] },
): { text: string; source?: string; module?: Module } {
  const { customers, products, invoices } = data;
  const q = prompt.toLowerCase();
  const m = getMetrics(days, data);
  if (/stock|inventor|restock|product/.test(q)) {
    const low = products.filter((p) => p.stock < p.reorder);
    return {
      text: `${low.length} products are below their reorder levels:\n\n${low.map((p) => `• ${p.name}: ${p.stock} in stock; reorder level ${p.reorder} (${p.reorder - p.stock} units below threshold).`).join('\n')}\n\nReview supplier information and create a purchase order draft in Automations. No orders will be sent.`,
      source: `Product inventory · ${products.length} local products`,
      module: 'Inventory',
    };
  }
  if (/invoice|overdue|payment|cash|financ/.test(q)) {
    const overdue = invoices.filter((i) => i.status === 'Overdue');
    return {
      text: `There are ${overdue.length} overdue invoices totaling ${money(overdue.reduce((s, i) => s + i.amount, 0))}:\n\n${overdue.map((i) => `• ${i.customer} — ${money(i.amount)} (${i.id}, due ${i.due}).`).join('\n')}\n\nTotal outstanding, including pending invoices, is ${money(m.outstanding)}. You can review a simulated payment reminder in Automations.`,
      source: `Accounts receivable · ${invoices.length} local invoices`,
      module: 'Finance',
    };
  }
  if (/customer|client/.test(q)) {
    const inactive = customers.filter((c) => c.status === 'Inactive');
    const sorted = [...customers].sort((a, b) => b.revenue - a.revenue);
    return {
      text: `Your top customers by lifetime sample revenue are:\n\n${sorted
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.name} — ${money(c.revenue)} across ${c.orders} orders.`)
        .join(
          '\n',
        )}\n\n${inactive.length ? `${inactive.map((c) => c.name).join(' and ')} are marked inactive in the local directory. Consider a personalized check-in.` : 'No customers are currently marked inactive.'}`,
      source: `Customer directory · ${customers.length} local customers`,
      module: 'Customers',
    };
  }
  if (/business|revenue|sales|order|doing|performance/.test(q))
    return {
      text: `Here’s your business snapshot for November ${15 - days}–14, 2026:\n\n• Revenue: ${money(m.revenue)}, up ${m.growth}% versus the previous comparison period.\n• Orders: ${m.orders} recorded in the daily sales summary.\n• Outstanding payments: ${money(m.outstanding)}.\n• Inventory: ${m.lowStock} products below their reorder levels.\n\nRevenue is trending positively. ${m.overdue || m.lowStock ? 'Review the current overdue invoices and low-stock products for your next action.' : 'There are no overdue invoices or low-stock products in your current local ledger.'}`,
      source: `Historical daily aggregates · ${days} days; current local invoices and inventory`,
      module: 'Analytics',
    };
  return {
    text: 'This frontend demo supports business summaries, inventory checks, overdue invoice reviews and top customer analysis. Try “Which products need restocking?” or choose one of the suggested questions. A real AI provider is not connected.',
    source: 'Local demo response',
  };
}
