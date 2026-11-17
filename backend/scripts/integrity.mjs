export const tables = [
  'User',
  'Company',
  'Membership',
  'Customer',
  'Product',
  'Order',
  'OrderItem',
  'InventoryMovement',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'AuditEvent',
  'IdempotencyKey',
  'WorkspaceState',
  'Conversation',
  'Job',
  'RateLimit',
];
export async function verifyLedger(client) {
  for (const table of tables) {
    const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [
      `erp."${table}"`,
    ]);
    if (!result.rows[0].present) throw new Error('Restored ERP schema is incomplete.');
  }
  const checks = [
    `SELECT count(*)::int AS invalid FROM erp."Product" WHERE stock < 0 OR price < 0`,
    `SELECT count(*)::int AS invalid FROM erp."Membership" WHERE role NOT IN ('owner', 'manager', 'staff')`,
    `SELECT count(*)::int AS invalid FROM erp."Order" o WHERE o.total <> COALESCE((SELECT sum(i.total) FROM erp."OrderItem" i WHERE i."orderId"=o.id AND i."companyId"=o."companyId"),0)`,
    `SELECT count(*)::int AS invalid FROM erp."Invoice" o WHERE o.total <> COALESCE((SELECT sum(i.total) FROM erp."InvoiceItem" i WHERE i."invoiceId"=o.id AND i."companyId"=o."companyId"),0)`,
    `SELECT count(*)::int AS invalid FROM erp."Invoice" i WHERE (SELECT COALESCE(sum(p.amount),0) FROM erp."Payment" p WHERE p."invoiceId"=i.id AND p."companyId"=i."companyId" AND p."reversedAt" IS NULL) > i.total`,
    `SELECT count(*)::int AS invalid FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='erp' AND NOT c.convalidated`,
  ];
  for (const query of checks) {
    const result = await client.query(query);
    if (Number(result.rows[0].invalid)) throw new Error('ERP integrity checks failed.');
  }
  return { tables: tables.length, integrityChecks: checks.length };
}
export function restoreTarget(source, target) {
  const from = new URL(source),
    to = new URL(target);
  if (
    !['postgres:', 'postgresql:'].includes(from.protocol) ||
    !['postgres:', 'postgresql:'].includes(to.protocol)
  )
    throw new Error('PostgreSQL URLs are required.');
  const database = decodeURIComponent(to.pathname.slice(1));
  if (!/^nexus_restore_[a-zA-Z0-9_]+$/.test(database))
    throw new Error('Restore target database must start with nexus_restore_.');
  if (
    from.hostname === to.hostname &&
    (from.port || '5432') === (to.port || '5432') &&
    from.pathname === to.pathname
  )
    throw new Error('Restore target must differ from the source database.');
  return database;
}
