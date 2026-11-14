// Local intent matching only: no LLM or remote integration.
import { customers, dailySales, invoices, products } from '@/data/mock-data';
import { getMetrics } from './demo-analytics';
import { money } from './utils';
import type { Module } from '@/types/business';
export function answer(prompt: string): { text: string; source?: string; module?: Module } {
  const q = prompt.toLowerCase();
  const m = getMetrics();
  if (/stock|inventor|restock|product/.test(q)) {
    const low = products.filter((p) => p.stock < p.reorder);
    return {
      text: `${low.length} products are below their reorder levels:\n\n${low.map((p) => `• ${p.name}: ${p.stock} in stock; reorder level ${p.reorder} (${p.reorder - p.stock} units below threshold).`).join('\n')}\n\nReview supplier information and create a purchase order draft in Automations. No orders will be sent.`,
      source: 'Product inventory · 6 sample products',
      module: 'Inventory',
    };
  }
  if (/invoice|overdue|payment|cash|financ/.test(q)) {
    const overdue = invoices.filter((i) => i.status === 'Overdue');
    return {
      text: `There are ${overdue.length} overdue invoices totaling ${money(overdue.reduce((s, i) => s + i.amount, 0))}:\n\n${overdue.map((i) => `• ${i.customer} — ${money(i.amount)} (${i.id}, due ${i.due}).`).join('\n')}\n\nTotal outstanding, including pending invoices, is ${money(m.outstanding)}. You can review a simulated payment reminder in Automations.`,
      source: 'Accounts receivable · 6 sample invoices',
      module: 'Finance',
    };
  }
  if (/customer|client/.test(q)) {
    const sorted = [...customers].sort((a, b) => b.revenue - a.revenue);
    return {
      text: `Your top customers by lifetime sample revenue are:\n\n${sorted
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.name} — ${money(c.revenue)} across ${c.orders} orders.`)
        .join('\n')}\n\n${customers
        .filter((c) => c.status === 'Inactive')
        .map((c) => c.name)
        .join(' and ')} have not ordered in over 60 days. Consider a personalized check-in.`,
      source: 'Customer directory · 7 sample customers',
      module: 'Customers',
    };
  }
  if (/business|revenue|sales|order|doing|performance/.test(q))
    return {
      text: `Here’s your business snapshot for November 1–14, 2026:\n\n• Revenue: ${money(m.revenue)}, up ${m.growth}% versus the previous comparison period.\n• Orders: ${m.orders} recorded in the daily sales summary.\n• Outstanding payments: ${money(m.outstanding)}.\n• Inventory: ${m.lowStock} products below their reorder levels.\n\nRevenue is trending positively. Your next priority is to follow up on overdue invoices and review low inventory.`,
      source: `Daily sales · ${dailySales.length} days, invoices and inventory`,
      module: 'Analytics',
    };
  return {
    text: 'This frontend demo supports business summaries, inventory checks, overdue invoice reviews and top customer analysis. Try “Which products need restocking?” or choose one of the suggested questions. A real AI provider is not connected.',
    source: 'Local demo response',
  };
}
