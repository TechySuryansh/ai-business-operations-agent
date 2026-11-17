import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { ApiError } from './rules';
import { db } from './db';
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 262144) {
      await reader.cancel();
      throw new ApiError(413, 'Request body is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'Invalid JSON.');
  }
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected) throw new ApiError(503, 'APP_URL is not configured.');
  if (request.headers.get('origin') !== new URL(expected).origin)
    throw new ApiError(403, 'Request origin is not allowed.');
}
export async function rateLimit(key: string, limit = 120) {
  const now = Date.now();
  const bucket = Math.floor(now / 60000);
  const entry = await db().rateLimit.upsert({
    where: { key: `${key}:${bucket}` },
    create: { key: `${key}:${bucket}`, expiresAt: new Date((bucket + 1) * 60000) },
    update: { count: { increment: 1 } },
  });
  if (entry.count > limit) throw new ApiError(429, 'Too many requests. Try again in a minute.');
}
export async function respond(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    const requestId = crypto.randomUUID();
    let status = 500,
      message = 'Something went wrong. Try again or contact your administrator.';
    if (e instanceof ApiError) {
      status = e.status;
      message = e.message;
    } else if (e instanceof z.ZodError) {
      status = 422;
      message = e.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .slice(0, 5)
        .join('; ');
    } else if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2025', 'P2034'].includes(e.code)
    ) {
      status = 409;
      message =
        'The record conflicts with existing data or changed concurrently. Refresh and try again.';
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          event: 'backend_error',
          requestId,
          type: e instanceof Error ? e.name : 'Unknown',
        }),
      );
    return Response.json(
      { error: message, requestId },
      {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          ...(status === 429 ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  }
}
