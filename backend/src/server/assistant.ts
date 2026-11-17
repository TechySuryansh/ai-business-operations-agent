import 'server-only';
import { z } from 'zod';
import type { Scope } from './auth';
import { snapshot } from './read-model';
import { ApiError, id } from './rules';
import { atomic } from './transaction';
import { getMetrics } from './metrics';
export async function ask(s: Scope, input: unknown) {
  const p = z
    .object({
      prompt: z.string().trim().min(1).max(4000),
      days: z.union([z.literal(7), z.literal(14)]),
      conversationId: id.optional(),
      requestId: id,
    })
    .parse(input);
  const state = await snapshot(s);
  const { data } = state;
  const q = p.prompt.toLowerCase();
  const m = getMetrics(p.days, data);
  const usd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  let text =
      'I can summarize booked orders, outstanding invoices, low stock and customer performance. This assistant uses deterministic queries; an external AI model is not connected.',
    module = 'Overview',
    source = 'Company ledger';
  if (/stock|inventory|product|restock/.test(q)) {
    const low = data.products.filter((p) => !p.archived && p.stock < p.reorder);
    module = 'Inventory';
    source = `${low.length} low-stock products`;
    text = low.length
      ? low
          .map((p) => `${p.name}: ${p.stock} available; reorder level ${p.reorder}. Record ${p.id}`)
          .join('\n')
      : 'No active products are below their reorder level.';
  } else if (/invoice|payment|cash|overdue|finance/.test(q)) {
    module = 'Finance';
    source = 'Invoice balances after active manual payments';
    text =
      `Outstanding: ${usd(m.outstanding)}. ${m.overdue} overdue invoices.\n` +
      data.invoices
        .filter((i) => i.status === 'Overdue')
        .slice(0, 30)
        .map(
          (i) =>
            `${i.number}: ${i.customer} owes ${usd(i.outstanding)}; due ${i.due}. Record ${i.id}`,
        )
        .join('\n');
  } else if (/customer|client/.test(q)) {
    module = 'Customers';
    source = 'All non-cancelled orders';
    text =
      [...data.customers]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((c) => `${c.name}: ${usd(c.revenue)} across ${c.orders} orders. Record ${c.id}`)
        .join('\n') || 'No customers have been created yet.';
  } else if (/revenue|sales|order|business|performance/.test(q)) {
    module = 'Analytics';
    source = `Last ${p.days} company-calendar days ending ${state.businessDate}`;
    text = `Booked order value: ${usd(m.revenue)} across ${m.orders} orders. ${m.growth === '—' ? 'There is no prior-period baseline.' : `Change versus previous period: ${m.growth}%.`}\nOutstanding invoices: ${usd(m.outstanding)}.\nBooked order value is not cash collected.`;
  }
  return atomic(async (tx) => {
    const conversationId = p.conversationId ?? p.requestId;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.userId + ':' + conversationId}, 0))::text`;
    const old = await tx.conversation.findFirst({
      where: { id: conversationId, companyId: s.companyId, userId: s.userId },
    });
    if (p.conversationId && !old) throw new ApiError(404, 'Conversation not found.');
    const messages = (old?.messages ?? []) as {
      id: string;
      role: string;
      text: string;
      module?: string;
      source?: string;
    }[];
    if (messages.some((m) => m.id === p.requestId)) return old;
    const next = [
      ...messages,
      { id: p.requestId, role: 'user', text: p.prompt },
      { id: crypto.randomUUID(), role: 'assistant', text, module, source },
    ].slice(-100);
    return old
      ? tx.conversation.update({ where: { id: old.id }, data: { messages: next } })
      : tx.conversation.create({
          data: { id: conversationId, companyId: s.companyId, userId: s.userId, messages: next },
        });
  });
}
