import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import type { Scope } from './auth';
import { db } from './db';
import { ApiError, today } from './rules';

const query = z.string().trim().max(120).optional();
const definitions = {
  getSalesSummary: {
    description:
      'Get booked sales and order count for the last N company-calendar days, including today. Excludes cancelled orders. Booked sales are not cash collected.',
    schema: z.strictObject({ days: z.number().int().min(1).max(366).optional() }),
  },
  findInvoices: {
    description:
      'Find invoices by invoice number, ID, or customer name, optionally filtered by status. Totals cover all matches, including those outside the returned list.',
    schema: z.strictObject({
      query,
      status: z.enum(['pending', 'overdue', 'paid', 'void']).optional(),
    }),
  },
  getTopCustomers: {
    description:
      'Rank customers by booked order value across all non-cancelled orders. Optionally filter by customer name.',
    schema: z.strictObject({ query }),
  },
  findProducts: {
    description: 'Find active products by name, ID, or SKU. Use lowStockOnly for reorder alerts.',
    schema: z.strictObject({ query, lowStockOnly: z.boolean().optional() }),
  },
};

export const tools = Object.entries(definitions).map(([name, definition]) => {
  const { $schema: _, ...parameters } = z.toJSONSchema(definition.schema);
  return { name, description: definition.description, parameters };
});

export function companyTools(scope: Scope, reportingDays: number) {
  // The request authenticates this scope. Neither the prompt nor the model can supply it.
  const { companyId, userId } = scope;
  return async (name: string, argumentsJson: string) => {
    if (!Object.hasOwn(definitions, name)) return { error: 'Unknown read-only tool.' };
    let args: unknown;
    try {
      args = JSON.parse(argumentsJson);
    } catch {
      return { error: 'Tool arguments must be a JSON object.' };
    }
    const parsed = definitions[name as keyof typeof definitions].schema.safeParse(args);
    if (!parsed.success)
      return { error: 'Invalid tool arguments. Use only the documented fields and values.' };
    return db().$transaction(
      async (tx) => {
        const access = await tx.membership.findUnique({
          where: { companyId_userId: { companyId, userId } },
          select: { company: { select: { timeZone: true, currency: true } } },
        });
        if (!access) throw new ApiError(403, 'You do not have access to this company.');
        const { timeZone, currency } = access.company;
        const asOf = today(timeZone);

        if (name === 'getSalesSummary') {
          const { days = reportingDays } = definitions.getSalesSummary.schema.parse(args);
          const [summary] = await tx.$queryRaw<
            { from: string; bookedSales: string; orderCount: number }[]
          >`
          SELECT to_char(${asOf}::date - (${days}::int - 1), 'YYYY-MM-DD') AS "from",
                 coalesce(sum(total), 0)::text AS "bookedSales", count(*)::int AS "orderCount"
          FROM erp."Order"
          WHERE "companyId" = ${companyId}::uuid AND status <> 'Cancelled'
            AND date >= ((${asOf}::date - (${days}::int - 1))::timestamp AT TIME ZONE ${timeZone} AT TIME ZONE 'UTC')
            AND date < ((${asOf}::date + 1)::timestamp AT TIME ZONE ${timeZone} AT TIME ZONE 'UTC')`;
          return {
            ...summary,
            through: asOf,
            currency,
            meaning: 'Booked order value, excluding cancelled orders',
          };
        }

        if (name === 'findInvoices') {
          const { query = '', status = '' } = definitions.findInvoices.schema.parse(args);
          const [found] = await tx.$queryRaw<
            { count: number; outstanding: string; records: unknown[] }[]
          >`
          WITH matches AS (
            SELECT i.id, i.number, c.name AS customer, i.due,
              i.total AS amount, coalesce(p.paid, 0) AS paid,
              CASE WHEN i."voidedAt" IS NOT NULL THEN 0 ELSE i.total - coalesce(p.paid, 0) END AS outstanding,
              CASE WHEN i."voidedAt" IS NOT NULL THEN 'void' WHEN i.total = coalesce(p.paid, 0) THEN 'paid'
                WHEN i.due < ${asOf}::date THEN 'overdue' ELSE 'pending' END AS status
            FROM erp."Invoice" i JOIN erp."Customer" c ON c.id = i."customerId" AND c."companyId" = i."companyId"
            LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM erp."Payment"
              WHERE "invoiceId" = i.id AND "companyId" = i."companyId" AND "reversedAt" IS NULL) p ON true
            WHERE i."companyId" = ${companyId}::uuid
              AND strpos(lower(concat_ws(' ', i.number, i.id, c.name)), lower(${query})) > 0
          ), filtered AS (SELECT * FROM matches WHERE ${status} = '' OR status = ${status})
          SELECT count(*)::int AS count, coalesce(sum(outstanding), 0)::text AS outstanding,
            coalesce((SELECT jsonb_agg(r) FROM (
              SELECT id, number, customer, due, amount::text, paid::text, outstanding::text, status
              FROM filtered ORDER BY due, id LIMIT 20
            ) r), '[]'::jsonb) AS records FROM filtered`;
          return { ...found, asOf, currency, truncated: found.count > found.records.length };
        }

        if (name === 'getTopCustomers') {
          const { query = '' } = definitions.getTopCustomers.schema.parse(args);
          const records = await tx.$queryRaw`
            SELECT c.id, c.name, coalesce(sum(o.total), 0)::text AS "bookedSales",
              count(o.id)::int AS "orderCount" FROM erp."Customer" c
            LEFT JOIN erp."Order" o ON o."customerId" = c.id AND o."companyId" = c."companyId" AND o.status <> 'Cancelled'
            WHERE c."companyId" = ${companyId}::uuid AND strpos(lower(c.name), lower(${query})) > 0
            GROUP BY c.id, c.name ORDER BY coalesce(sum(o.total), 0) DESC, c.id LIMIT 21`;
          const rows = records as unknown[];
          return { records: rows.slice(0, 20), currency, truncated: rows.length > 20 };
        }

        const { query = '', lowStockOnly = false } = definitions.findProducts.schema.parse(args);
        const [found] = await tx.$queryRaw<{ count: number; records: unknown[] }[]>`
        WITH matches AS (
          SELECT id, sku, name, stock, reorder, price::text FROM erp."Product"
          WHERE "companyId" = ${companyId}::uuid AND NOT archived
            AND (NOT ${lowStockOnly} OR stock < reorder)
            AND strpos(lower(concat_ws(' ', sku, id, name)), lower(${query})) > 0
        ) SELECT count(*)::int AS count,
          coalesce((SELECT jsonb_agg(r) FROM (SELECT * FROM matches ORDER BY name, id LIMIT 20) r), '[]'::jsonb) AS records
        FROM matches`;
        return { ...found, currency, truncated: found.count > found.records.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  };
}
