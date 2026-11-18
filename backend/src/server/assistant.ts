import 'server-only';
import { z } from 'zod';
import type { Scope } from './auth';
import { companyTools } from './assistant-tools';
import { assistantContext } from './assistant-context';
import { ApiError, id, today } from './rules';
import { atomic } from './transaction';
import { db } from './db';
import { generateAnswer, aiConfigured, aiProvider } from './openai';
export async function ask(
  s: Scope,
  input: unknown,
  onDelta?: (text: string) => void,
  signal?: AbortSignal,
) {
  const p = z
    .object({
      prompt: z.string().trim().min(1).max(4000),
      days: z.union([z.literal(7), z.literal(14)]),
      conversationId: id.optional(),
      requestId: id,
    })
    .parse(input);
  const conversationId = p.conversationId ?? p.requestId;
  const prior = await db().conversation.findFirst({
    where: { id: conversationId, companyId: s.companyId, userId: s.userId },
  });
  if (p.conversationId && !prior) throw new ApiError(404, 'Conversation not found.');
  const history = z
    .array(z.object({ id: z.string(), role: z.string(), text: z.string() }))
    .parse(prior?.messages ?? []);
  if (history.some((m) => m.id === p.requestId)) return prior;
  const businessDate = today(s.timeZone);
  let text: string;
  const module = 'Overview';
  let source = 'Ledger rules (AI not configured) · Company ledger';
  if (aiConfigured()) {
    text = await generateAnswer(
      p.prompt,
      { businessDate, reportingDays: p.days },
      history,
      onDelta,
      signal,
      companyTools(s, p.days),
    );
    source = `${aiProvider()} · Company ledger through ${businessDate}`;
  } else {
    const { fallback } = await assistantContext(s, p.prompt, p.days, history);
    text = fallback;
    onDelta?.(text);
  }
  if (signal?.aborted) throw new ApiError(499, 'Request cancelled.');
  return atomic(async (tx) => {
    const conversationId = p.conversationId ?? p.requestId;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.userId + ':' + conversationId}, 0))::text`;
    const old = await tx.conversation.findFirst({
      where: { id: conversationId, companyId: s.companyId, userId: s.userId },
    });
    if (p.conversationId && !old) throw new ApiError(404, 'Conversation not found.');
    const messages = (old?.messages ?? []) as {
      id: string;
      role: string;
      text: string;
      module?: string;
      source?: string;
    }[];
    if (messages.some((m) => m.id === p.requestId)) return old;
    if (JSON.stringify(old?.messages ?? []) !== JSON.stringify(prior?.messages ?? []))
      throw new ApiError(
        409,
        'This conversation changed while answering. Reload it before retrying.',
      );
    const next = [
      ...messages,
      { id: p.requestId, role: 'user', text: p.prompt },
      { id: crypto.randomUUID(), role: 'assistant', text, module, source },
    ].slice(-100);
    return old
      ? tx.conversation.update({ where: { id: old.id }, data: { messages: next } })
      : tx.conversation.create({
          data: { id: conversationId, companyId: s.companyId, userId: s.userId, messages: next },
        });
  });
}
