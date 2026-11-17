# Backend implementation plan

Implementation layout: `frontend/` owns pages and UI; `backend/` owns API routes, services and Prisma. Root npm workspace scripts run and verify both applications.

## Audit (before backend implementation)
The frontend is Next.js 16 / React 19 / TypeScript. BusinessProvider owns fictional records in localStorage. Orders and invoices have aggregate amounts only, no relational line items. Workspace stores alert decisions, drafts and preferences locally; assistant stores conversations locally. Charts use fixed November 2026 aggregates. There is no authentication or backend. Static export prevents server routes.

## Design
Next.js Node route handlers → verified Supabase session → company membership → validated service operations → Prisma → PostgreSQL. Keep business tables in a private `erp` schema, unexposed to Supabase's Data API. All reads/writes include company scope; compound foreign keys prevent cross-company links. No service-role Supabase key is needed. Auth is externally managed; local application users reference its verified UUID.

Entities: Company, User, Membership, Customer, Product, Order/OrderItem, InventoryMovement, Invoice/InvoiceItem, Payment, AuditEvent, IdempotencyKey, WorkspaceState, Conversation, Job, RateLimit.

## Rules and defaults
- USD only initially; integer quantities; decimal(14,2) money; no implicit tax calculation. Display tax as zero until a jurisdiction-specific policy is implemented.
- Orders deduct stock at creation. Processing → Shipped → Delivered. Processing orders can be cancelled and restore stock once. Issued invoices prevent cancellation.
- Prices are captured from products on the server. Order lines are immutable after creation.
- Invoices snapshot order lines, one per order. Due date cannot precede issue date. Overdue is derived from the company's date. Payments are manual records, not charges. No overpayment; reversal retains original payment and reason. Void requires no active payments.
- Document IDs use UUIDs; human document numbers use transactionally incremented company counters. No hard deletion of financial records.
- Owners manage settings/memberships, managers manage financial and operational records, staff read and manage customers. All members can query company data; staff cannot mutate money or stock.
- Optimistic versions reject stale edits; financial writes use serializable transactions with bounded retries; request keys prevent duplicates.
- Demo remains explicitly available at /demo. Live workspace never falls back to fictional records on error.

## Integration order
1. Foundation and schema/migrations.
2. Supabase session, onboarding, company scope and roles.
3. Customer/product services and live provider.
4. Order/inventory/invoice/payment workflows.
5. Real analytics/search/report inputs.
6. Persistent workspace state, assistant history, durable draft jobs.
7. Tests and deployment documentation.

## Verification
Typecheck, existing UI tests, backend rule tests, migration/schema validation, build. PostgreSQL integration tests require an isolated test database and must prove rollback, concurrency, cross-tenant denial and retries. Supabase auth email/session end-to-end checks require a configured Supabase project. Never report these external checks as passed without executing them.
