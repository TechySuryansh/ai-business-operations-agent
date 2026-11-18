import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import type { Scope } from './auth';
import { today } from './rules';
import { dailySales, ledgerSQL } from './ledger-query';

export function contextTopics(prompt: string, history: { role: string; text: string }[]) {
  const current = prompt.toLowerCase();
  const detect = (q: string) => ({
    inventory: /stock|inventory|product|restock/.test(q),
    finance: /invoice|payment|cash|overdue|finance|balance/.test(q),
    customers: /customer|client/.test(q),
    sales: /revenue|sales|order|business|performance|summary/.test(q),
  });
  let topics = detect(current);
  if (!Object.values(topics).some(Boolean)) {
    // Resolve short follow-ups from recent user intent; do not query unrelated collections.
    topics = detect(
      history
        .filter((m) => m.role === 'user')
        .slice(-2)
        .map((m) => m.text)
        .join(' ')
        .toLowerCase(),
    );
  }
  if (!Object.values(topics).some(Boolean)) topics.sales = true;
  return topics;
}
export async function assistantContext(
  s: Scope,
  prompt: string,
  days: 7 | 14,
  history: { role: string; text: string }[],
) {
  const topics = contextTopics(prompt, history);
  const company = await db().company.findUniqueOrThrow({
    where: { id: s.companyId },
    select: { name: true, currency: true, timeZone: true },
  });
  const context: Record<string, unknown> = {
    company,
    businessDate: today(s.timeZone),
    reportingDays: days,
    limits:
      'Only requested topics are loaded. Listed records are capped at 20; totals cover all matching records. Missing topics and unlisted details are not available.',
  };
  const explanations: string[] = [];
  const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: company.currency }).format(n);
  await Promise.all([
    topics.inventory
      ? (async () => {
          const [r] = await db().$queryRaw<{ count: number; records: unknown[] }[]>(Prisma.sql`
        WITH low AS (SELECT id,name,stock,reorder FROM erp."Product"
          WHERE "companyId"=${s.companyId}::uuid AND NOT archived AND stock<reorder)
        SELECT (SELECT count(*)::int FROM low) count,
          coalesce((SELECT jsonb_agg(p) FROM (SELECT * FROM low ORDER BY name,id LIMIT 20) p),'[]'::jsonb) records`);
          context.inventory = r;
          explanations.push(
            `${r.count} active products need restocking. Up to 20 records: ${JSON.stringify(r.records)}`,
          );
        })()
      : Promise.resolve(),
    topics.finance
      ? (async () => {
          const [r] = await db().$queryRaw<
            { outstanding: number; overdue: number; records: unknown[] }[]
          >(Prisma.sql`
        WITH payments AS (
          SELECT "invoiceId",sum(amount) paid FROM erp."Payment"
          WHERE "companyId"=${s.companyId}::uuid AND "reversedAt" IS NULL GROUP BY "invoiceId"
        ), invoices AS (
          SELECT i.id,i.number,c.name customer,to_char(i.due,'YYYY-MM-DD') due,
            (i.total-coalesce(p.paid,0))::float8 outstanding,
            CASE WHEN i.total=coalesce(p.paid,0) THEN 'Paid'
              WHEN i.due < ${today(s.timeZone)}::date THEN 'Overdue' ELSE 'Pending' END status
          FROM erp."Invoice" i JOIN erp."Customer" c ON c.id=i."customerId" AND c."companyId"=i."companyId"
          LEFT JOIN payments p ON p."invoiceId"=i.id
          WHERE i."companyId"=${s.companyId}::uuid AND i."voidedAt" IS NULL
        )
        SELECT coalesce(sum(outstanding) FILTER (WHERE status <> 'Void'),0)::float8 outstanding,
          count(*) FILTER (WHERE status='Overdue')::int overdue,
          coalesce((SELECT jsonb_agg(i) FROM (SELECT id,number,customer,due,outstanding FROM invoices WHERE status='Overdue' ORDER BY due,id LIMIT 20) i),'[]'::jsonb) records
        FROM invoices`);
          context.finance = r;
          explanations.push(
            `Outstanding: ${money(r.outstanding)}. ${r.overdue} overdue invoices. Up to 20 overdue records: ${JSON.stringify(r.records)}`,
          );
        })()
      : Promise.resolve(),
    topics.customers
      ? (async () => {
          const records = await db().$queryRaw(
            Prisma.sql`SELECT id,name,revenue,orders FROM (${ledgerSQL(s, 'customers')}) c ORDER BY revenue DESC,id LIMIT 20`,
          );
          context.customers = { basis: 'All non-cancelled orders', records };
          explanations.push(
            `Top customers by booked order value (up to 20): ${JSON.stringify(records)}`,
          );
        })()
      : Promise.resolve(),
    topics.sales
      ? (async () => {
          const series = await dailySales(s);
          const current = series.slice(-days),
            previous = series.slice(-days * 2, -days);
          const revenue = current.reduce((n, d) => n + d.revenue, 0),
            baseline = previous.reduce((n, d) => n + d.revenue, 0);
          const orders = current.reduce((n, d) => n + d.orders, 0),
            growth = baseline ? (((revenue - baseline) / baseline) * 100).toFixed(1) : null;
          context.sales = {
            revenue,
            orders,
            previousRevenue: baseline,
            growthPercent: growth,
            series: current,
          };
          explanations.push(
            `Last ${days} company-calendar days: booked order value ${money(revenue)} across ${orders} orders. ${growth === null ? 'No prior-period baseline.' : `Change: ${growth}%.`} Booked order value is not cash collected.`,
          );
        })()
      : Promise.resolve(),
  ]);
  return { context, fallback: explanations.join('\n\n') };
}
