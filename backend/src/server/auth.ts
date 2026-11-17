import 'server-only';
import { db } from './db';
import { supabaseServer, authConfigured } from '@/lib/supabase/server';
import { ApiError } from './rules';
export type Scope = { companyId: string; userId: string; role: string; timeZone: string };
export async function user() {
  if (!authConfigured()) throw new ApiError(503, 'Supabase authentication is not configured.');
  const { data, error } = await (await supabaseServer()).auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'Sign in to continue.');
  return data.user;
}
export async function scope(companyId: string): Promise<Scope> {
  const identity = await user();
  const membership = await db().membership.findUnique({
    where: { companyId_userId: { companyId, userId: identity.id } },
    include: { company: true },
  });
  if (!membership) throw new ApiError(403, 'You do not have access to this company.');
  return {
    companyId,
    userId: identity.id,
    role: membership.role,
    timeZone: membership.company.timeZone,
  };
}
