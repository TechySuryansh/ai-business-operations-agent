import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import type { Scope } from './auth';
import { audit, type Tx } from './transaction';
import {
  ApiError,
  authorize,
  assertVersion,
  customerInput,
  productInput,
  orderInput,
  id,
  version,
  moneyInput,
  dateInput,
  text,
  today,
  orderTransition,
} from './rules';
const D = Prisma.Decimal;
export async function command(tx: Tx, s: Scope, action: string, body: unknown): Promise<unknown> {
  const companyId = s.companyId;
  if (action === 'customer.save') {
    authorize(s.role, 'customer');
    const p = customerInput.extend({ id: id.optional(), version: version.optional() }).parse(body);
    const { id: recordId, version: expected, ...data } = p;
    if (recordId) {
      const old = await tx.customer.findFirst({ where: { id: recordId, companyId } });
      if (!old) throw new ApiError(404, 'Customer not found.');
      assertVersion(old.version, expected ?? 0);
    }
    const result = recordId
      ? await tx.customer.update({
          where: { companyId_id: { companyId, id: recordId } },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.customer.create({ data: { ...data, companyId } });
    await audit(tx, s, `Saved customer ${result.id} · ${result.name}`);
    return result;
  }
  authorize(s.role, 'operate');
  if (action === 'product.save') {
    const p = productInput
      .extend({
        id: id.optional(),
        version: version.optional(),
        stock: z.number().int().min(0).max(100000000).optional(),
        reason: text.optional(),
        archived: z.boolean().optional(),
      })
      .parse(body);
    const { id: recordId, version: expected, stock, reason, archived, ...data } = p;
    const old = recordId
      ? await tx.product.findFirst({ where: { id: recordId, companyId } })
      : null;
    if (recordId && !old) throw new ApiError(404, 'Product not found.');
    if (old) assertVersion(old.version, expected ?? 0);
    const delta = (stock ?? old?.stock ?? 0) - (old?.stock ?? 0);
    if (delta && !reason) throw new ApiError(422, 'Provide a reason for the stock adjustment.');
    const result = old
      ? await tx.product.update({
          where: { companyId_id: { companyId, id: old.id } },
          data: { ...data, archived, stock, version: { increment: 1 } },
        })
      : await tx.product.create({ data: { ...data, companyId, stock: stock ?? 0 } });
    if (delta)
      await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: result.id,
          quantity: delta,
          reason: reason!,
          actorId: s.userId,
        },
      });
    await audit(tx, s, `Saved product ${result.id}${delta ? ` · stock adjustment ${delta}` : ''}`);
    return result;
  }
  if (action === 'order.create') {
    const p = orderInput.parse(body);
    const customer = await tx.customer.findFirst({
      where: { id: p.customerId, companyId, status: 'Active' },
    });
    if (!customer) throw new ApiError(422, 'Choose an active customer in this company.');
    const quantities = new Map<string, number>();
    for (const line of p.lines)
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    const lines = [];
    for (const [productId, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
      const product = await tx.product.findFirst({
        where: { id: productId, companyId, archived: false },
      });
      if (!product) throw new ApiError(422, 'A selected product is unavailable.');
      const changed = await tx.product.updateMany({
        where: { id: productId, companyId, stock: { gte: quantity }, archived: false },
        data: { stock: { decrement: quantity }, version: { increment: 1 } },
      });
      if (!changed.count) throw new ApiError(409, `Insufficient stock for ${product.name}.`);
      lines.push({
        companyId,
        productId,
        description: product.name,
        quantity,
        unitPrice: product.price,
        total: product.price.mul(quantity),
      });
    }
    const company = await tx.company.update({
      where: { id: companyId },
      data: { orderSequence: { increment: 1 } },
    });
    const result = await tx.order.create({
      data: {
        companyId,
        customerId: customer.id,
        number: `ORD-${String(company.orderSequence).padStart(6, '0')}`,
        total: lines.reduce((sum, l) => sum.add(l.total), new D(0)),
        items: { create: lines.map(({ companyId: _, ...line }) => line) },
      },
      include: { items: true },
    });
    for (const line of lines)
      await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: line.productId,
          quantity: -line.quantity,
          reason: 'Order created',
          reference: result.id,
          actorId: s.userId,
        },
      });
    await audit(tx, s, `Created order ${result.id} · ${result.number}`);
    return result;
  }
  if (action === 'order.status') {
    const p = z
      .object({ id, version, status: z.enum(['Shipped', 'Delivered', 'Cancelled']) })
      .parse(body);
    const old = await tx.order.findFirst({
      where: { id: p.id, companyId },
      include: { items: true, invoice: true },
    });
    if (!old) throw new ApiError(404, 'Order not found.');
    assertVersion(old.version, p.version);
    orderTransition(old.status, p.status);
    if (p.status === 'Cancelled') {
      if (old.invoice) throw new ApiError(409, 'An invoiced order cannot be cancelled.');
      for (const line of old.items) {
        await tx.product.update({
          where: { companyId_id: { companyId, id: line.productId } },
          data: { stock: { increment: line.quantity }, version: { increment: 1 } },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: line.productId,
            quantity: line.quantity,
            reason: 'Order cancelled',
            reference: old.id,
            actorId: s.userId,
          },
        });
      }
    }
    const result = await tx.order.update({
      where: { companyId_id: { companyId, id: p.id } },
      data: { status: p.status, version: { increment: 1 } },
    });
    await audit(tx, s, `Order ${old.id} changed to ${p.status}`);
    return result;
  }
  if (action === 'invoice.create') {
    const p = z.object({ orderId: id, due: dateInput }).parse(body);
    if (p.due < today(s.timeZone))
      throw new ApiError(422, 'Due date cannot precede the issue date.');
    const order = await tx.order.findFirst({
      where: { id: p.orderId, companyId },
      include: { items: true, invoice: true },
    });
    if (!order || order.status === 'Cancelled')
      throw new ApiError(422, 'Choose an eligible order.');
    if (order.invoice) throw new ApiError(409, 'This order already has an invoice.');
    const company = await tx.company.update({
      where: { id: companyId },
      data: { invoiceSequence: { increment: 1 } },
    });
    const result = await tx.invoice.create({
      data: {
        companyId,
        customerId: order.customerId,
        orderId: order.id,
        number: `INV-${String(company.invoiceSequence).padStart(6, '0')}`,
        due: new Date(p.due),
        total: order.total,
        items: {
          create: order.items.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
          })),
        },
      },
    });
    await audit(tx, s, `Issued invoice ${result.id} · ${result.number}`);
    return result;
  }
  if (['payment.create', 'payment.reverse', 'invoice.void'].includes(action)) {
    const p = z
      .object({
        id,
        version,
        amount: moneyInput.optional(),
        reference: text.optional(),
        paymentId: id.optional(),
        reason: text.optional(),
      })
      .parse(body);
    const invoice = await tx.invoice.findFirst({
      where: { id: p.id, companyId },
      include: { payments: true },
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found.');
    assertVersion(invoice.version, p.version);
    if (invoice.voidedAt) throw new ApiError(409, 'This invoice is void.');
    const paid = invoice.payments
      .filter((p) => !p.reversedAt)
      .reduce((sum, p) => sum.add(p.amount), new D(0));
    if (action === 'payment.create') {
      const amount = new D(p.amount ?? '0');
      if (!amount.gt(0) || amount.gt(invoice.total.sub(paid)))
        throw new ApiError(
          422,
          'Payment must be positive and cannot exceed the outstanding balance.',
        );
      if (!p.reference) throw new ApiError(422, 'A payment reference is required.');
      await tx.payment.create({
        data: { companyId, invoiceId: invoice.id, amount, reference: p.reference },
      });
    } else if (action === 'payment.reverse') {
      if (!p.reason) throw new ApiError(422, 'A reversal reason is required.');
      const payment = invoice.payments.find((pay) => pay.id === p.paymentId && !pay.reversedAt);
      if (!payment) throw new ApiError(404, 'Active payment not found.');
      await tx.payment.update({
        where: { id: payment.id },
        data: { reversedAt: new Date(), reversalReason: p.reason },
      });
    } else if (paid.gt(0))
      throw new ApiError(409, 'Reverse active payments before voiding an invoice.');
    const result = await tx.invoice.update({
      where: { companyId_id: { companyId, id: invoice.id } },
      data: {
        version: { increment: 1 },
        ...(action === 'invoice.void' ? { voidedAt: new Date() } : {}),
      },
    });
    await audit(tx, s, `${action} · invoice ${invoice.id}${p.reason ? ` · ${p.reason}` : ''}`);
    return result;
  }
  throw new ApiError(404, 'Unknown action.');
}
