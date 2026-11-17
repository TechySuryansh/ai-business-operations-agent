import { z } from 'zod';
import { db } from '@/server/db';
import { user, scope } from '@/server/auth';
import { body, checkOrigin, rateLimit, respond } from '@/server/http';
import { id, text, ApiError, authorize } from '@/server/rules';
import { atomic, mutation } from '@/server/transaction';
import { command } from '@/server/services';
import { snapshot, listRecords } from '@/server/read-model';
import { enqueue, processJob, reviewDraft, toggleWorkflow } from '@/server/jobs';
import { ask } from '@/server/assistant';
import { saveWorkspace } from '@/server/workspace';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, ctx: Context) {
  return respond(async () => {
    const { path } = await ctx.params;
    if (path.join('/') === 'companies') {
      const identity = await user();
      return db().membership.findMany({
        where: { userId: identity.id },
        include: { company: true },
      });
    }
    const companyId = id.parse(path[0]);
    const s = await scope(companyId);
    await rateLimit(`${s.userId}:read`, 180);
    switch (path[1]) {
      case 'snapshot':
        return snapshot(s);
      case 'records':
        return listRecords(s, new URL(request.url));
      case 'workspace':
        return db().workspaceState.findUnique({ where: { companyId } });
      case 'conversations':
        return db().conversation.findMany({
          where: { companyId, userId: s.userId },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        });
      case 'jobs':
        return db().job.findMany({
          where: { companyId },
          orderBy: { availableAt: 'desc' },
          take: 50,
        });
      case 'members':
        authorize(s.role, 'admin');
        return db().membership.findMany({ where: { companyId }, include: { user: true } });
      default:
        throw new ApiError(404, 'Endpoint not found.');
    }
  });
}
export async function POST(request: Request, ctx: Context) {
  return respond(async () => {
    checkOrigin(request);
    const { path } = await ctx.params;
    if (path.join('/') === 'companies') {
      const identity = await user();
      await rateLimit(`${identity.id}:onboard`, 5);
      const p = z.object({ name: text }).parse(await body(request));
      return atomic(async (tx) => {
        // One-company onboarding; joining additional companies uses owner-managed membership.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.id}, 0))::text`;
        const existing = await tx.membership.findFirst({
          where: { userId: identity.id },
          include: { company: true },
        });
        if (existing) return existing.company;
        await tx.user.upsert({
          where: { id: identity.id },
          create: { id: identity.id, email: identity.email?.toLowerCase() ?? '' },
          update: { email: identity.email?.toLowerCase() ?? '' },
        });
        return tx.company.create({
          data: { name: p.name, memberships: { create: { userId: identity.id, role: 'owner' } } },
        });
      });
    }
    const companyId = id.parse(path[0]);
    const s = await scope(companyId);
    await rateLimit(`${s.userId}:write`, 60);
    const p = await body(request);
    const key = z.string().min(8).max(100).parse(request.headers.get('idempotency-key'));
    if (path[1] === 'conversations-clear') {
      await db().conversation.deleteMany({ where: { companyId, userId: s.userId } });
      return { cleared: true };
    }
    if (path[1] === 'workflow-toggle') return toggleWorkflow(s, p);
    if (path[1] === 'jobs') {
      const job = await enqueue(s, p);
      await processJob(job.id);
      return db().job.findUnique({ where: { id: job.id } });
    }
    if (path[1] === 'draft-review') return reviewDraft(s, p);
    if (path[1] === 'assistant') {
      await rateLimit(`${s.userId}:assistant`, 20);
      return ask(s, p);
    }
    if (path[1] === 'command') {
      const input = z.object({ action: text, payload: z.unknown() }).parse(p);
      return mutation(s, key, input.action, input.payload, (tx) =>
        command(tx, s, input.action, input.payload),
      );
    }
    if (path[1] === 'workspace')
      return mutation(s, key, 'workspace', p, (tx) => saveWorkspace(tx, s, p));
    if (path[1] === 'members') {
      authorize(s.role, 'admin');
      const input = z.object({ email: z.email(), role: z.enum(['manager', 'staff']) }).parse(p);
      return mutation(s, key, 'members', input, async (tx) => {
        const target = await tx.user.findFirst({ where: { email: input.email.toLowerCase() } });
        if (!target)
          throw new ApiError(422, 'This user must first sign up and create their workspace.');
        const old = await tx.membership.findUnique({
          where: { companyId_userId: { companyId, userId: target.id } },
        });
        if (old?.role === 'owner')
          throw new ApiError(409, 'Owner membership cannot be changed here.');
        return tx.membership.upsert({
          where: { companyId_userId: { companyId, userId: target.id } },
          create: { companyId, userId: target.id, role: input.role },
          update: { role: input.role },
        });
      });
    }
    throw new ApiError(404, 'Endpoint not found.');
  });
}
