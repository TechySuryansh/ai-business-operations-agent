import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import type { Scope } from './auth';
import { ApiError, today } from './rules';
import type { snapshot } from './read-model';
export type Ledger = Awaited<ReturnType<typeof snapshot>>['data'];
export type Collection = 'customers' | 'products' | 'orders' | 'invoices';
type Row = Ledger[Collection][number];

// All SQL fragments come from fixed server definitions. User values are bound parameters.
export function ledgerSQL(s: Scope, type: Collection, ids?: string[]): Prisma.Sql {
  const tenant = Prisma.sql`r."companyId" = ${s.companyId}::uuid`;
  const selected = ids
    ? ids.length
      ? Prisma.sql`AND r.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.sql`AND false`
    : Prisma.empty;
  if (type === 'customers')
    return Prisma.sql`
    SELECT r.id, r.name, r.contact, r.email, r.location, r.status, r.version,
      coalesce(a.revenue,0)::float8 revenue, coalesce(a.orders,0)::int orders,
      to_char(coalesce(a.last,r."createdAt"),'YYYY-MM-DD') "lastOrder"
    FROM erp."Customer" r LEFT JOIN (
      SELECT o."customerId",sum(o.total) revenue, count(*) orders, max(o.date) last FROM erp."Order" o
      WHERE o."companyId"=${s.companyId}::uuid AND o.status <> 'Cancelled' GROUP BY o."customerId"
    ) a ON a."customerId"=r.id WHERE ${tenant} ${selected}`;
  if (type === 'products')
    return Prisma.sql`
    SELECT r.id,r.name,r.category,r.sku,r.stock,r.reorder,r.price::float8 price,r.supplier,r.archived,r.version,
      coalesce(a.sold,0)::int sold, coalesce(a.revenue,0)::float8 revenue,
      CASE WHEN r.stock < r.reorder THEN 'Low stock' ELSE 'Healthy' END status
    FROM erp."Product" r LEFT JOIN (
      SELECT i."productId",sum(i.quantity) sold,sum(i.total) revenue FROM erp."OrderItem" i
      JOIN erp."Order" o ON o.id=i."orderId" AND o."companyId"=i."companyId"
      WHERE i."companyId"=${s.companyId}::uuid AND o.status <> 'Cancelled' GROUP BY i."productId"
    ) a ON a."productId"=r.id WHERE ${tenant} ${selected}`;
  if (type === 'orders')
    return Prisma.sql`
    SELECT r.id,r.number,r.version,r."customerId",c.name customer,
      to_char(r.date AT TIME ZONE 'UTC' AT TIME ZONE ${s.timeZone},'YYYY-MM-DD') date,
      r.total::float8 amount,r.status,coalesce(a.items,0)::int items,coalesce(a.lines,'[]'::jsonb) lines
    FROM erp."Order" r JOIN erp."Customer" c ON c.id=r."customerId" AND c."companyId"=r."companyId"
    LEFT JOIN LATERAL (
      SELECT sum(i.quantity) items,jsonb_agg(jsonb_build_object('productId',i."productId",'description',i.description,'quantity',i.quantity,'unitPrice',i."unitPrice")) lines
      FROM erp."OrderItem" i WHERE i."companyId"=${s.companyId}::uuid AND i."orderId"=r.id
    ) a ON true WHERE ${tenant} ${selected}`;
  return Prisma.sql`
    SELECT r.id,r.number,r.version,r."orderId",c.name customer,
      to_char(r.issued AT TIME ZONE 'UTC' AT TIME ZONE ${s.timeZone},'YYYY-MM-DD') issued,
      to_char(r.due,'YYYY-MM-DD') due,r.total::float8 amount,
      (r.total-coalesce(a.paid,0))::float8 outstanding,coalesce(a.paid,0)::float8 paid,
      CASE WHEN r."voidedAt" IS NOT NULL THEN 'Void' WHEN r.total=coalesce(a.paid,0) THEN 'Paid'
        WHEN r.due < ${today(s.timeZone)}::date THEN 'Overdue' ELSE 'Pending' END status,
      coalesce(a.payments,'[]'::jsonb) payments
    FROM erp."Invoice" r JOIN erp."Customer" c ON c.id=r."customerId" AND c."companyId"=r."companyId"
    LEFT JOIN LATERAL (
      SELECT sum(p.amount) FILTER (WHERE p."reversedAt" IS NULL) paid,
        jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'reference',p.reference,'reversedAt',p."reversedAt")) payments
      FROM erp."Payment" p WHERE p."companyId"=${s.companyId}::uuid AND p."invoiceId"=r.id
    ) a ON true WHERE ${tenant} ${selected}`;
}
export async function readRows<K extends Collection>(
  s: Scope,
  type: K,
  ids: string[],
): Promise<Ledger[K]> {
  if (!ids.length) return [] as unknown as Ledger[K];
  return db().$queryRaw(ledgerSQL(s, type, ids)) as Promise<Ledger[K]>;
}
const columns: Record<Collection, string[]> = {
  customers: ['id', 'name', 'contact', 'location', 'orders', 'revenue', 'status'],
  products: ['id', 'name', 'sku', 'stock', 'reorder', 'price', 'status'],
  orders: ['id', 'customer', 'date', 'items', 'amount', 'status'],
  invoices: ['id', 'customer', 'issued', 'due', 'amount', 'status'],
};
export async function listRecords(s: Scope, url: URL) {
  const type = url.searchParams.get('type') as Collection;
  if (!Object.hasOwn(columns, type))
    throw new ApiError(422, 'Choose customers, products, orders or invoices.');
  const integer = (name: string, fallback: number, max: number) => {
    const value = Number(url.searchParams.get(name) ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new ApiError(422, `Invalid ${name}.`);
    return value;
  };
  const page = integer('page', 1, 10000),
    size = integer('size', 25, 100);
  const requestedSort =
    url.searchParams.get('sort') || (type === 'customers' || type === 'products' ? 'name' : 'id');
  if (!columns[type].includes(requestedSort)) throw new ApiError(422, 'Invalid sort field.');
  const sort = Prisma.raw(`"${requestedSort}"`);
  const direction =
    url.searchParams.get('direction') === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const q = (url.searchParams.get('q') ?? '').slice(0, 200).toLowerCase();
  const status = url.searchParams.get('status') || 'All';
  const [result] = await db().$queryRaw<
    { rows: Row[]; total: number; allTotal: number }[]
  >(Prisma.sql`
    WITH records AS (${ledgerSQL(s, type)}), filtered AS (
      SELECT * FROM records r WHERE (${q}='' OR strpos(lower(to_jsonb(r)::text),${q})>0)
        AND (${status}='All' OR status=${status})
    ), page_rows AS (SELECT * FROM filtered ORDER BY ${sort} ${direction},id ASC LIMIT ${size} OFFSET ${(page - 1) * size})
    SELECT coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_rows p),'[]'::jsonb) rows,
      (SELECT count(*)::int FROM filtered) total,(SELECT count(*)::int FROM records) "allTotal"`);
  return { ...result, page, size };
}
export async function dailySales(s: Scope) {
  return db().$queryRaw<Ledger['dailySales']>(Prisma.sql`
    WITH dates AS (SELECT generate_series(${today(s.timeZone)}::date-27,${today(s.timeZone)}::date,'1 day')::date d), totals AS (
      SELECT (date AT TIME ZONE 'UTC' AT TIME ZONE ${s.timeZone})::date d,sum(total)::float8 revenue,count(*)::int orders
      FROM erp."Order" WHERE "companyId"=${s.companyId}::uuid AND status <> 'Cancelled'
      AND date >= ((${today(s.timeZone)}::date-27)::timestamp AT TIME ZONE ${s.timeZone} AT TIME ZONE 'UTC')
      GROUP BY 1
    ) SELECT to_char(dates.d,'YYYY-MM-DD') date,to_char(dates.d,'Mon FMDD') AS "day",
      coalesce(t.revenue,0)::float8 revenue,0 previous,coalesce(t.orders,0)::int orders
      FROM dates LEFT JOIN totals t USING(d) ORDER BY dates.d`);
}
export async function mutationPatch(s: Scope, action: string, result: unknown) {
  const record = result as { id: string; customerId?: string };
  const ids: Record<Collection, string[]> = {
    customers: [],
    products: [],
    orders: [],
    invoices: [],
  };
  if (action === 'customer.save') {
    ids.customers = [record.id];
    const [orders, invoices] = await Promise.all([
      db().order.findMany({
        where: { companyId: s.companyId, customerId: record.id },
        select: { id: true },
      }),
      db().invoice.findMany({
        where: { companyId: s.companyId, customerId: record.id },
        select: { id: true },
      }),
    ]);
    ids.orders = orders.map((r) => r.id);
    ids.invoices = invoices.map((r) => r.id);
  } else if (action === 'product.save') ids.products = [record.id];
  else if (action.startsWith('order.')) {
    ids.orders = [record.id];
    ids.customers = record.customerId ? [record.customerId] : [];
    const items = await db().orderItem.findMany({
      where: { companyId: s.companyId, orderId: record.id },
      select: { productId: true },
    });
    ids.products = [...new Set(items.map((i) => i.productId))];
  } else ids.invoices = [record.id];
  const [customers, products, orders, invoices, audit, series] = await Promise.all([
    readRows(s, 'customers', ids.customers),
    readRows(s, 'products', ids.products),
    readRows(s, 'orders', ids.orders),
    readRows(s, 'invoices', ids.invoices),
    db().auditEvent.findMany({
      where: { companyId: s.companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    action.startsWith('order.') ? dailySales(s) : Promise.resolve(undefined),
  ]);
  return {
    data: { customers, products, orders, invoices, ...(series ? { dailySales: series } : {}) },
    audit: audit.map((e) => ({ id: e.id, at: e.createdAt.toISOString(), message: e.message })),
  };
}
