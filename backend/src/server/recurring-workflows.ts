import 'server-only';
import { db } from './db';

export const recurringJobPrefix = 'recurring:';

// The cron can run concurrently. The unique company/key index claims each local occurrence once.
export function enqueueRecurringWorkflows(now = new Date()) {
  const instant = now.toISOString();
  return db().$executeRaw`
    INSERT INTO erp."Job" (id, "companyId", key, kind, "availableAt")
    SELECT gen_random_uuid(), c.id,
      ${recurringJobPrefix} || (workflow->>'category') || ':' || to_char(local.clock, 'YYYY-MM-DD'),
      workflow->>'category', ${instant}::timestamptz AT TIME ZONE 'UTC'
    FROM erp."WorkspaceState" w
    JOIN erp."Company" c ON c.id = w."companyId"
    CROSS JOIN LATERAL (SELECT ${instant}::timestamptz AT TIME ZONE c."timeZone" AS clock) local
    CROSS JOIN LATERAL jsonb_array_elements(w.data->'workflows') workflow
    WHERE workflow->>'enabled' = 'true'
      AND workflow->>'category' IN ('Inventory', 'Finance', 'Sales')
      AND local.clock::time >= TIME '09:00'
      AND (workflow->>'schedule' = 'daily'
        OR (workflow->>'schedule' = 'weekly' AND extract(isodow FROM local.clock) = 1))
      AND jsonb_array_length(coalesce(w.data->'drafts', '[]'::jsonb)) < 200
    ON CONFLICT ("companyId", key) DO NOTHING`;
}
