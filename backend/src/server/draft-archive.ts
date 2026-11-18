import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import type { Scope } from './auth';
import { db } from './db';
import { ApiError, authorize, id } from './rules';
import { mutation } from './transaction';

export async function archiveDraft(s: Scope, input: unknown, key: string) {
  authorize(s.role, 'operate');
  const p = z.object({ id, version: z.number().int().positive() }).parse(input);
  return mutation(s, key, 'draft-archive', p, async (tx) => {
    const workspace = await tx.workspaceState.findUnique({ where: { companyId: s.companyId } });
    if (!workspace || workspace.version !== p.version)
      throw new ApiError(409, 'Draft history changed. Refresh it before archiving.');
    const state = workspace.data as unknown as {
      drafts: Record<string, Prisma.JsonValue>[];
    };
    const draft = state.drafts.find((item) => item.id === p.id);
    if (!draft) throw new ApiError(404, 'Draft not found.');
    const archivedAt = new Date().toISOString();
    const result = await tx.job.updateMany({
      where: { companyId: s.companyId, id: p.id, status: 'completed' },
      data: { result: { ...draft, archivedAt, archivedBy: s.userId } as Prisma.InputJsonObject },
    });
    if (result.count !== 1) throw new ApiError(409, 'The source job could not be found.');
    state.drafts = state.drafts.filter((item) => item.id !== p.id);
    await tx.workspaceState.update({
      where: { companyId: s.companyId },
      data: { data: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
    });
    return { id: p.id, archivedAt };
  });
}

export async function listArchivedDrafts(s: Scope, after: string | null) {
  const limit = 25;
  const cursor = after ? id.parse(after) : null;
  const rows = await db().$queryRaw<{ id: string; result: Prisma.JsonValue }[]>`
    SELECT j.id, j.result FROM erp."Job" j
    WHERE j."companyId" = ${s.companyId}::uuid AND j.result ? 'archivedAt'
      AND (${cursor}::uuid IS NULL OR j.id > ${cursor}::uuid)
    ORDER BY j.id LIMIT ${limit + 1}`;
  return {
    drafts: rows.slice(0, limit).map((row) => row.result),
    next: rows.length > limit ? rows[limit - 1].id : null,
  };
}
