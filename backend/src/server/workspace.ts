import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { authorize, assertVersion, text, version } from './rules';
import type { Scope } from './auth';
import { audit, type Tx } from './transaction';
const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Invalid timezone');
const history = z.object({ at: z.iso.datetime(), action: z.string().max(1000) });
export const workspaceInput = z.object({
  preferences: z.object({
    companyName: text,
    timeZone,
    emailDigest: z.boolean(),
    compactTables: z.boolean(),
    sidebarCollapsed: z.boolean().optional(),
  }),
  dismissed: z.array(z.string().max(100)).max(1000),
  snoozed: z.record(z.string().max(100), z.number().finite()).optional(),
  workflows: z
    .array(
      z.object({
        id: text,
        title: text,
        description: z.string().max(2000),
        category: text,
        lastRun: text,
        runs: z.number().int().nonnegative(),
        enabled: z.boolean(),
      }),
    )
    .max(20),
  drafts: z
    .array(
      z.object({
        id: text,
        automationId: text,
        title: text,
        body: z.string().max(20000),
        created: z.string().max(100),
        status: z.enum(['Needs review', 'Approved in demo', 'Approved', 'Rejected']),
        reason: z.string().max(2000).optional(),
        history: z.array(history).max(100).optional(),
      }),
    )
    .max(200),
});
export async function saveWorkspace(tx: Tx, s: Scope, input: unknown) {
  authorize(s.role, 'operate');
  const p = z
    .object({ version: z.number().int().nonnegative(), data: workspaceInput })
    .parse(input);
  const old = await tx.workspaceState.findUnique({ where: { companyId: s.companyId } });
  assertVersion(old?.version ?? 0, p.version);
  const company = await tx.company.findUniqueOrThrow({ where: { id: s.companyId } });
  if (
    company.name !== p.data.preferences.companyName ||
    company.timeZone !== p.data.preferences.timeZone
  ) {
    authorize(s.role, 'admin');
    await tx.company.update({
      where: { id: s.companyId },
      data: { name: p.data.preferences.companyName, timeZone: p.data.preferences.timeZone },
    });
  }
  // Generic settings saves cannot rewrite immutable draft decisions or execution history.
  const previous = old?.data as
    { drafts?: unknown[]; workflows?: { id: string; runs: number; lastRun: string }[] } | undefined;
  p.data.drafts = (previous?.drafts ?? []) as typeof p.data.drafts;
  p.data.workflows = p.data.workflows.map((w) => {
    const existing = previous?.workflows?.find((a) => a.id === w.id);
    return { ...w, runs: existing?.runs ?? 0, lastRun: existing?.lastRun ?? 'Never' };
  });
  const result = await tx.workspaceState.upsert({
    where: { companyId: s.companyId },
    create: { companyId: s.companyId, data: p.data as Prisma.InputJsonValue },
    update: { data: p.data as Prisma.InputJsonValue, version: { increment: 1 } },
  });
  await audit(tx, s, 'Updated workspace settings, alert decisions or automation drafts');
  return result;
}
