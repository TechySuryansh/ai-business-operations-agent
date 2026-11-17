import { timingSafeEqual } from 'node:crypto';
import { db } from '@/server/db';
import { processJob } from '@/server/jobs';
import { respond } from '@/server/http';
import { ApiError } from '@/server/rules';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return respond(async () => {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization') ?? '';
    if (!secret || secret.length < 32) throw new ApiError(503, 'Job scheduler is not configured.');
    const expected = Buffer.from(`Bearer ${secret}`),
      actual = Buffer.from(auth);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new ApiError(401, 'Unauthorized.');
    const pending = await db().job.findMany({
      where: { status: 'pending', availableAt: { lte: new Date() } },
      orderBy: { availableAt: 'asc' },
      take: 10,
    });
    const results = [];
    for (const job of pending) {
      try {
        await processJob(job.id);
        results.push({ id: job.id, status: 'processed' });
      } catch {
        results.push({ id: job.id, status: 'retry-or-failed' });
      }
    }
    await db().rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { results };
  });
}
