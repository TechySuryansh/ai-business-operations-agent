import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const text = z.string().trim().min(1).max(200);
export const id = z.string().uuid();
export const moneyInput = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a nonnegative amount with at most two decimal places.'),
  );
export const version = z.number().int().positive();
export const customerInput = z.object({
  name: text,
  contact: text,
  email: z.email().max(254),
  location: text,
  status: z.enum(['Active', 'Inactive']),
});
export const productInput = z.object({
  name: text,
  category: text,
  sku: text.transform((v) => v.toUpperCase()),
  price: moneyInput,
  reorder: z.number().int().min(0).max(100000000),
  supplier: text,
});
export const orderInput = z.object({
  customerId: id,
  lines: z
    .array(z.object({ productId: id, quantity: z.number().int().min(1).max(1000000) }))
    .min(1)
    .max(100),
});
export const dateInput = z.iso.date();
export function authorize(role: string, action: 'read' | 'customer' | 'operate' | 'admin') {
  if (
    !['owner', 'manager', 'staff'].includes(role) ||
    (action === 'admin' && role !== 'owner') ||
    (action === 'operate' && role === 'staff')
  )
    throw new ApiError(403, 'You do not have permission for this action.');
}
export function orderTransition(from: string, to: string) {
  if (
    !(
      {
        Processing: ['Shipped', 'Cancelled'],
        Shipped: ['Delivered'],
        Delivered: [],
        Cancelled: [],
      } as Record<string, string[]>
    )[from]?.includes(to)
  )
    throw new ApiError(409, 'This order status transition is not allowed.');
}
export function today(timeZone = 'UTC', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function assertVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new ApiError(409, 'This record changed. Refresh before editing it again.');
}
