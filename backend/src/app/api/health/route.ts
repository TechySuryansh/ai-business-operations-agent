import { db } from '@/server/db';
import { authConfigured } from '@/lib/supabase/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    if (!authConfigured() || !process.env.DATABASE_URL || !process.env.APP_URL)
      throw new Error('Configuration');
    await db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
        // A read on the migrated schema also checks the runtime role's permissions.
        await tx.company.findFirst({ select: { id: true } });
      },
      { timeout: 5000, maxWait: 3000 },
    );
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
