import 'server-only';
import { db } from './db';
import { today, ApiError } from './rules';
import type { Scope } from './auth';
import { atomic } from './transaction';
const date = (d: Date) => d.toISOString().slice(0, 10);
export async function snapshot(s: Scope) {
  const companyId = s.companyId;
  return atomic(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    const customers = await tx.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      take: 5001,
    });
    const products = await tx.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      take: 5001,
    });
    const orders = await tx.order.findMany({
      where: { companyId },
      include: { items: true, customer: true },
      orderBy: { date: 'desc' },
      take: 5001,
    });
    const invoices = await tx.invoice.findMany({
      where: { companyId },
      include: { payments: true, customer: true, items: true },
      orderBy: { issued: 'desc' },
      take: 5001,
    });
    const audit = await tx.auditEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if ([customers, products, orders, invoices].some((rows) => rows.length > 5000))
      throw new ApiError(
        422,
        'This workspace exceeds the interactive ledger limit. Use the paginated records API for larger datasets.',
      );
    const businessDate = today(company.timeZone);
    const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
    const activeInvoices = invoices.filter((i) => !i.voidedAt);
    const dailySales = Array.from({ length: 28 }, (_, index) => {
      const d = new Date(`${businessDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 27 + index);
      const key = date(d);
      return {
        date: key,
        day: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(d),
        revenue: activeOrders
          .filter((o) => today(company.timeZone, o.date) === key)
          .reduce((sum, o) => sum + Number(o.total), 0),
        previous: 0,
        orders: activeOrders.filter((o) => today(company.timeZone, o.date) === key).length,
      };
    });
    return {
      company: {
        id: company.id,
        name: company.name,
        timeZone: company.timeZone,
        currency: company.currency,
      },
      role: s.role,
      businessDate,
      audit: audit.map((e) => ({ id: e.id, at: e.createdAt.toISOString(), message: e.message })),
      data: {
        live: true,
        dailySales,
        customers: customers.map((c) => ({
          ...c,
          createdAt: undefined,
          revenue: activeOrders
            .filter((o) => o.customerId === c.id)
            .reduce((sum, o) => sum + Number(o.total), 0),
          orders: activeOrders.filter((o) => o.customerId === c.id).length,
          lastOrder: date(activeOrders.find((o) => o.customerId === c.id)?.date ?? c.createdAt),
        })),
        products: products.map((p) => ({
          ...p,
          price: Number(p.price),
          sold: activeOrders
            .flatMap((o) => o.items)
            .filter((i) => i.productId === p.id)
            .reduce((sum, i) => sum + i.quantity, 0),
          revenue: activeOrders
            .flatMap((o) => o.items)
            .filter((i) => i.productId === p.id)
            .reduce((sum, i) => sum + Number(i.total), 0),
        })),
        orders: orders.map((o) => ({
          id: o.id,
          number: o.number,
          version: o.version,
          customerId: o.customerId,
          customer: o.customer.name,
          date: today(company.timeZone, o.date),
          items: o.items.reduce((sum, i) => sum + i.quantity, 0),
          amount: Number(o.total),
          status: o.status,
          lines: o.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
        })),
        invoices: invoices.map((i) => {
          const paid = i.payments
            .filter((p) => !p.reversedAt)
            .reduce((sum, p) => sum + Number(p.amount), 0);
          const outstanding = Math.round((Number(i.total) - paid) * 100) / 100;
          return {
            id: i.id,
            number: i.number,
            version: i.version,
            orderId: i.orderId,
            customer: i.customer.name,
            issued: today(company.timeZone, i.issued),
            due: date(i.due),
            amount: Number(i.total),
            outstanding,
            paid,
            status: i.voidedAt
              ? 'Void'
              : outstanding === 0
                ? 'Paid'
                : date(i.due) < businessDate
                  ? 'Overdue'
                  : 'Pending',
            payments: i.payments.map((p) => ({
              ...p,
              amount: Number(p.amount),
              createdAt: p.createdAt.toISOString(),
              reversedAt: p.reversedAt?.toISOString() ?? null,
            })),
          };
        }),
      },
    };
  });
}
export async function listRecords(s: Scope, url: URL) {
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') ?? '').slice(0, 200);
  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
  const take = Math.max(1, Math.min(100, Number(url.searchParams.get('size')) || 25));
  const skip = (Math.floor(page) - 1) * Math.floor(take);
  const companyId = s.companyId;
  if (type === 'customers')
    return db().customer.findMany({
      where: { companyId, name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      skip,
      take: Math.floor(take),
    });
  if (type === 'products')
    return db().product.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      skip,
      take: Math.floor(take),
    });
  if (type === 'orders')
    return db().order.findMany({
      where: { companyId, number: { contains: q, mode: 'insensitive' } },
      orderBy: { date: 'desc' },
      skip,
      take: Math.floor(take),
    });
  if (type === 'invoices')
    return db().invoice.findMany({
      where: { companyId, number: { contains: q, mode: 'insensitive' } },
      orderBy: { issued: 'desc' },
      skip,
      take: Math.floor(take),
    });
  throw new ApiError(422, 'Choose customers, products, orders or invoices.');
}
