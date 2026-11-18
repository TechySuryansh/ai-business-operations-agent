import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import type { Scope } from './auth';
import { db } from './db';
import { atomic, audit, mutation, type Tx } from './transaction';
import { ApiError, authorize, id, text, today } from './rules';
import { recurringJobPrefix } from './recurring-workflows';
import { automations } from './workflows';
export async function enqueue(s: Scope, input: unknown) {
  authorize(s.role, 'operate');
  const p = z
    .object({ key: z.string().uuid(), kind: z.enum(['Inventory', 'Finance', 'Sales']) })
    .parse(input);
  return db().job.upsert({
    where: { companyId_key: { companyId: s.companyId, key: p.key } },
    create: { companyId: s.companyId, key: p.key, kind: p.kind },
    update: {},
  });
}
export async function processJob(jobId: string) {
  try {
    return await atomic(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM erp."Job" WHERE id = ${jobId}::uuid AND status = 'pending' AND "availableAt" <= now() FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return null;
      const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
      const company = await tx.company.findUniqueOrThrow({ where: { id: job.companyId } });
      const old = await tx.workspaceState.findUnique({ where: { companyId: job.companyId } });
      const state = (old?.data ?? {
        preferences: {
          companyName: company.name,
          timeZone: company.timeZone,
          emailDigest: false,
          compactTables: false,
        },
        dismissed: [],
        snoozed: {},
        drafts: [],
        workflows: automations.map((a) => ({ ...a, runs: 0, lastRun: 'Never' })),
      }) as unknown as {
        drafts: Record<string, unknown>[];
        workflows: {
          id: string;
          category: string;
          runs: number;
          lastRun: string;
          enabled: boolean;
          schedule?: 'off' | 'daily' | 'weekly';
        }[];
      };
      const recurring = job.key.startsWith(recurringJobPrefix);
      const skip = (reason: string) =>
        tx.job.update({
          where: { id: job.id },
          data: { status: 'skipped', error: reason, attempts: { increment: 1 } },
        });
      const workflow = state.workflows.find((a) => a.category === job.kind);
      if (recurring && (!workflow?.enabled || !workflow.schedule || workflow.schedule === 'off'))
        return skip('Recurring workflow paused or disabled.');
      if (!workflow || !workflow.enabled) throw new ApiError(409, 'This workflow is paused.');
      let lines: string[] = [];
      if (job.kind === 'Inventory') {
        const products = await tx.product.findMany({
          where: { companyId: job.companyId, archived: false },
          take: 5000,
        });
        lines = products
          .filter((p) => p.stock < p.reorder)
          .map(
            (p) =>
              `${p.name} · ${p.supplier}: purchase at least ${p.reorder - p.stock} units to reach the reorder level. Record ${p.id}`,
          );
      } else if (job.kind === 'Finance') {
        const invoices = await tx.invoice.findMany({
          where: {
            companyId: job.companyId,
            voidedAt: null,
            due: { lt: new Date(today(company.timeZone)) },
          },
          include: { payments: true, customer: true },
          take: 5000,
        });
        lines = invoices
          .filter(
            (i) =>
              Number(i.total) >
              i.payments.filter((p) => !p.reversedAt).reduce((n, p) => n + Number(p.amount), 0),
          )
          .map(
            (i) =>
              `${i.number} · ${i.customer.name}: outstanding USD ${(Number(i.total) - i.payments.filter((p) => !p.reversedAt).reduce((n, p) => n + Number(p.amount), 0)).toFixed(2)}; due ${i.due.toISOString().slice(0, 10)}. Record ${i.id}`,
          );
      } else {
        const customers = await tx.customer.findMany({
          where: { companyId: job.companyId, status: 'Inactive' },
          take: 5000,
        });
        lines = customers.map(
          (c) => `Prepare an account follow-up for ${c.name} (${c.email}). Record ${c.id}`,
        );
      }
      if (recurring && !lines.length) return skip('No matching records require review.');
      const now = new Date().toISOString();
      const draft = {
        id: job.id,
        automationId: workflow.id,
        title: `${job.kind} review · ${today(company.timeZone)}`,
        body: lines.length ? lines.join('\n') : 'No matching records require action.',
        status: 'Needs review',
        created: now,
        history: [{ at: now, action: 'Draft generated from company records' }],
      };
      if (state.drafts.length >= 200)
        throw new ApiError(
          409,
          'Draft history has reached its limit. Archive history before generating more drafts.',
        );
      state.drafts = [draft, ...state.drafts];
      workflow.runs++;
      workflow.lastRun = now;
      await tx.workspaceState.upsert({
        where: { companyId: job.companyId },
        create: { companyId: job.companyId, data: state as unknown as Prisma.InputJsonValue },
        update: { data: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
      });
      return tx.job.update({
        where: { id: job.id },
        data: { status: 'completed', attempts: { increment: 1 }, error: null, result: draft },
      });
    });
  } catch (e) {
    await db().job.updateMany({
      where: { id: jobId, status: 'pending' },
      data: {
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + 60000),
        error: e instanceof ApiError ? e.message : 'Processing failed; retry scheduled.',
      },
    });
    await db().job.updateMany({
      where: { id: jobId, attempts: { gte: 3 } },
      data: { status: 'failed' },
    });
    throw e;
  }
}
export async function reviewDraft(s: Scope, input: unknown, key?: string) {
  authorize(s.role, 'operate');
  const p = z
    .object({
      id,
      version: z.number().int().positive(),
      status: z.enum(['Needs review', 'Approved', 'Rejected']),
      body: z.string().min(1).max(20000),
      reason: z.string().max(2000).optional(),
    })
    .parse(input);
  const save = async (tx: Tx) => {
    const old = await tx.workspaceState.findUnique({ where: { companyId: s.companyId } });
    if (!old || old.version !== p.version)
      throw new ApiError(409, 'Draft history changed. Reload it before reviewing.');
    const state = old.data as unknown as {
      drafts: {
        id: string;
        status: string;
        body: string;
        reason?: string;
        history?: { at: string; action: string }[];
      }[];
    };
    const draft = state.drafts.find((d) => d.id === p.id);
    if (!draft) throw new ApiError(404, 'Draft not found.');
    if (draft.status !== 'Needs review')
      throw new ApiError(409, 'This draft has already been reviewed.');
    if (p.status === 'Rejected' && !p.reason?.trim())
      throw new ApiError(422, 'Provide a rejection reason.');
    draft.body = p.body;
    draft.status = p.status;
    if (p.reason) draft.reason = p.reason;
    draft.history = [
      ...(draft.history ?? []),
      {
        at: new Date().toISOString(),
        action:
          p.status === 'Approved'
            ? 'Approved; no external action executed'
            : p.status === 'Rejected'
              ? `Rejected: ${p.reason}`
              : 'Draft edited',
      },
    ];
    await audit(tx, s, `Draft ${draft.id}: ${p.status}`);
    return tx.workspaceState.update({
      where: { companyId: s.companyId },
      data: { data: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
    });
  };
  return key ? mutation(s, key, 'draft-review', p, save) : atomic(save);
}

export async function toggleWorkflow(s: Scope, input: unknown, key?: string) {
  authorize(s.role, 'operate');
  const p = z
    .object({
      kind: z.enum(['Inventory', 'Finance', 'Sales']),
      enabled: z.boolean(),
      schedule: z.enum(['off', 'daily', 'weekly']).optional(),
      version: z.number().int().nonnegative(),
    })
    .parse(input);
  const save = async (tx: Tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: s.companyId } });
    const old = await tx.workspaceState.findUnique({ where: { companyId: s.companyId } });
    if ((old?.version ?? 0) !== p.version)
      throw new ApiError(409, 'Workflow settings changed. Refresh and try again.');
    const state = (old?.data ?? {
      preferences: {
        companyName: company.name,
        timeZone: company.timeZone,
        emailDigest: false,
        compactTables: false,
      },
      dismissed: [],
      snoozed: {},
      drafts: [],
      workflows: automations.map((a) => ({ ...a, runs: 0, lastRun: 'Never' })),
    }) as unknown as {
      workflows: { category: string; enabled: boolean; schedule?: 'off' | 'daily' | 'weekly' }[];
    };
    const workflow = state.workflows.find((w) => w.category === p.kind);
    if (!workflow) throw new ApiError(404, 'Workflow not found.');
    workflow.enabled = p.enabled;
    if (p.schedule !== undefined) workflow.schedule = p.schedule;
    await audit(
      tx,
      s,
      p.schedule === undefined
        ? `${p.kind} workflow ${p.enabled ? 'enabled' : 'paused'}`
        : `${p.kind} recurring schedule set to ${p.schedule}`,
    );
    return tx.workspaceState.upsert({
      where: { companyId: s.companyId },
      create: { companyId: s.companyId, data: state as unknown as Prisma.InputJsonValue },
      update: { data: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
    });
  };
  return key ? mutation(s, key, 'workflow-toggle', p, save) : atomic(save);
}
