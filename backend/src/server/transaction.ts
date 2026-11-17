import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import type { Scope } from './auth';
import { ApiError } from './rules';
export type Tx = Prisma.TransactionClient;
export async function atomic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db().$transaction(fn, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(e.code) &&
        attempt < 3
      )
        continue;
      throw e;
    }
  }
}
export async function audit(tx: Tx, s: Scope, message: string) {
  await tx.auditEvent.create({ data: { companyId: s.companyId, actorId: s.userId, message } });
}
export async function mutation(
  s: Scope,
  key: string,
  command: string,
  payload: unknown,
  fn: (tx: Tx) => Promise<unknown>,
) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([s.userId, command, payload]))
    .digest('hex');
  return atomic(async (tx) => {
    // Serialize requests with the same tenant/key before checking the result.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.companyId + ':' + key}, 0))::text`;
    const existing = await tx.idempotencyKey.findUnique({
      where: { companyId_key: { companyId: s.companyId, key } },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ApiError(409, 'This request key was already used for a different action.');
      return existing.result;
    }
    const result = JSON.parse(JSON.stringify(await fn(tx))) as Prisma.InputJsonValue;
    await tx.idempotencyKey.create({ data: { companyId: s.companyId, key, fingerprint, result } });
    return result;
  });
}
