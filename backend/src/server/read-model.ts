import 'server-only';
import { db } from './db';
import { today } from './rules';
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
    });
    const products = await tx.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    const orders = await tx.order.findMany({
      where: { companyId },
      include: { items: true, customer: true },
      orderBy: { date: 'desc' },
    });
    const invoices = await tx.invoice.findMany({
      where: { companyId },
      include: { payments: true, customer: true },
      orderBy: { issued: 'desc' },
    });
    const audit = await tx.auditEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const businessDate = today(company.timeZone);
    const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byCustomer = new Map<string, { revenue: number; orders: number; last: Date }>();
    const byProduct = new Map<string, { revenue: number; sold: number }>();
    for (const order of activeOrders) {
      const key = today(company.timeZone, order.date);
      const day = byDay.get(key) ?? { revenue: 0, orders: 0 };
      day.revenue += Number(order.total);
      day.orders++;
      byDay.set(key, day);
      const customer = byCustomer.get(order.customerId) ?? {
        revenue: 0,
        orders: 0,
        last: order.date,
      };
      customer.revenue += Number(order.total);
      customer.orders++;
      if (order.date > customer.last) customer.last = order.date;
      byCustomer.set(order.customerId, customer);
      for (const item of order.items) {
        const product = byProduct.get(item.productId) ?? { revenue: 0, sold: 0 };
        product.revenue += Number(item.total);
        product.sold += item.quantity;
        byProduct.set(item.productId, product);
      }
    }
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
        revenue: byDay.get(key)?.revenue ?? 0,
        previous: 0,
        orders: byDay.get(key)?.orders ?? 0,
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
          revenue: byCustomer.get(c.id)?.revenue ?? 0,
          orders: byCustomer.get(c.id)?.orders ?? 0,
          lastOrder: date(byCustomer.get(c.id)?.last ?? c.createdAt),
        })),
        products: products.map((p) => ({
          ...p,
          price: Number(p.price),
          sold: byProduct.get(p.id)?.sold ?? 0,
          revenue: byProduct.get(p.id)?.revenue ?? 0,
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
export { listRecords } from './ledger-query';
