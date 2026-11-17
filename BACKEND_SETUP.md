# Backend setup and operations

See [DEPLOYMENT.md](DEPLOYMENT.md) for the prepared Render release, environment checks, auth template configuration, scheduling, monitoring, backup/restore commands and real-account verification. Hosted setup still requires connected Supabase and hosting accounts.

## Folder layout

`frontend/` contains the UI, demo, login pages and auth callback. `backend/` contains all business API routes, services, Prisma schema/migrations and database tests. Both are independent Next.js applications managed by npm workspaces. The root package provides commands for both; install dependencies from the repository root.

## What is ready locally
Next.js Node backend, Prisma migrations, Supabase Auth wiring, company onboarding and memberships, transactional customers/products/orders/invoices/payments, shared alert/settings persistence, durable draft jobs, deterministic assistant and private conversation history. The original fictional frontend remains at `/demo`. `/` is the authenticated application and shows setup instructions until configured. No mock records are automatically imported into a live company.

## Prerequisites and environment
Use a supported Node LTS release compatible with Next 16 and Prisma 7 (Node 22.12+ or Node 24 LTS). Install dependencies with `npm ci`; its postinstall generates Prisma Client. Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`. Do not commit credentials. Each Next.js application loads its own environment file; Prisma reads `backend/.env`. Root environment files are not used.

```sh
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Configure both applications to use the same Supabase project. Frontend public settings are needed for browser sign-in and server-rendered auth pages; backend server settings independently verify the forwarded session cookies.

Create a Supabase project yourself; no project, account, or billable infrastructure is created by this repository.

- Frontend `NEXT_PUBLIC_SUPABASE_URL` and backend `SUPABASE_URL`: project URL from Supabase settings.
- Frontend `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and backend `SUPABASE_PUBLISHABLE_KEY`: public publishable key (legacy anon key may be used if applicable). Never put a service-role or secret key here.
- Backend `DATABASE_URL`: runtime PostgreSQL connection. Prefer Supabase's session pooler for initial setup; match the host/user/port shown in its Connect dialog. The runtime pool is capped at five connections per Node process. Allocate the total connection budget across instances.
- Backend `DIRECT_URL`: direct PostgreSQL connection or session pooler for migrations. Do not use a transaction pooler for migration administration.
- Backend `APP_URL`: exact application origin, e.g. `http://127.0.0.1:3000`. The browser must use the same origin. Mutations reject missing/mismatching Origin headers.
- Backend `CRON_SECRET`: random value of at least 32 characters, required only for scheduled job processing. Keep it server-side.

- Frontend `BACKEND_URL`: API service origin, default `http://127.0.0.1:3001`. This is a server-side setting, read when Next.js builds its rewrite rules. Set it before building for production.

Use Supabase's recommended TLS connection settings for your deployment. Never disable certificate verification as a connectivity workaround.

## Database setup

```sh
npm run db:validate
npm run db:migrate
npm run dev
```

`npm run dev` starts both applications. Open **http://127.0.0.1:3000**; the API runs on port **3001**. The frontend forwards `/api/*` to the backend, including cookies, request bodies and headers. Browser API calls remain on the frontend origin. Use `npm run dev:frontend` and `npm run dev:backend` in separate terminals if preferred. You can also run `npm run dev` inside either application folder.

`db:migrate` applies reviewed SQL migrations from `backend/prisma/migrations`. It does not reset or seed data. `db:dev` is only for developing new migrations against a disposable development database. Do not run reset commands against production.

All business tables are in the private `erp` schema. **Do not expose `erp` in Supabase's Data API settings.** The migration revokes schema/table access from PUBLIC and, when present, Supabase's anon/authenticated roles. Prisma uses a server-only SQL connection. Every service scopes reads/writes to a verified company membership; compound foreign keys prevent cross-company relationships. Supabase Auth RLS does not automatically protect this SQL connection. No claim is made that application queries execute as the signed-in Supabase database role.

For deployment, create a separate restricted runtime PostgreSQL role with USAGE on `erp` and SELECT/INSERT/UPDATE/DELETE on its tables; reserve schema changes and migrations for an administrative role. Keep `erp` inaccessible to browser Data API roles. The application needs no Supabase service-role key. The runtime role may read all company rows, so backend authorization tests are mandatory; private-schema isolation is not per-tenant RLS.

## Authentication configuration
In Supabase Auth URL Configuration set the site URL to `APP_URL` and allow the appropriate production and development redirect URLs.

Configure the **Confirm signup** email template's confirmation link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
```

Configure the **Reset password** template link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

Configure SMTP and email rate limits appropriate to your environment before inviting users. Verify the actual signup, confirmation, recovery, sign-out, expired-session refresh and revoked-session flows with your Supabase project. These cannot be verified without that project.

Sign up, confirm the email, sign in, then create your company. It starts empty. Owners can add an already registered application user by email from Settings. That user must have completed onboarding first. This is membership assignment, not an invitation email. Multiple company memberships are selectable at login; no ownership transfer or account deletion UI is included yet.

## Permissions

| Operation | Staff | Manager | Owner |
|---|---|---|---|
| Read company records, reports and assistant | Yes | Yes | Yes |
| Create/edit/archive customers | Yes | Yes | Yes |
| Products, stock, orders, invoices, payments | No | Yes | Yes |
| Shared alerts and automation drafts | No | Yes | Yes |
| Company name/timezone and team memberships | No | No | Yes |

The backend checks roles on every mutation. Hiding or disabling a UI button is not an authorization boundary. Conversations are private to their creator and company.

## Business rules
- USD only. Monetary inputs have at most two fractional digits; PostgreSQL `numeric(14,2)` and Prisma Decimal calculate totals. Taxes/discounts/credit notes are not implemented. Do not use this as a tax-compliant accounting system until jurisdiction-specific requirements are implemented.
- Integer product quantities. Creating an order deducts stock immediately in the same transaction. Prices come from the product catalog, not browser totals.
- Processing → Shipped → Delivered. An uninvoiced Processing order may be cancelled; cancellation restores stock once. Lines/prices are immutable after creation.
- One invoice per order; issued line items are snapshots. Due date cannot precede the company-local issue date. Overdue is derived, not user-editable.
- Payments are manual records of money received elsewhere. Partial payments and reversals are supported. Overpayments are rejected. Paid invoices cannot be voided until payments are reversed. No payment gateway is connected.
- Customer/product archive does not erase historical records. Audit events and stock movements are retained. Financial mutations require idempotency keys; edits require record versions.
- Dashboard “revenue” means booked non-cancelled order value, not accounting recognition or cash collected. Periods use company-calendar days. Product/customer totals cover all orders. Receivables exclude void invoices and subtract unreversed payments.

## Jobs and assistant
Live Automations enqueue a durable job and try processing it immediately. A transaction locks the job row, generates a draft from company records, saves it, and marks the job complete together. Duplicate requests do not create duplicate drafts. Failed work retries at one-minute intervals, up to three failed attempts; errors appear in the job history.

To process retryable pending jobs, configure your scheduler to POST `/api/jobs/run` with `Authorization: Bearer <CRON_SECRET>` every minute. Each call processes at most ten jobs and clears expired rate-limit buckets. This endpoint processes queued work; it does not automatically schedule recurring business workflows. Configure scheduling only after deployment. Approval records a decision and never sends email or executes financial operations.

The assistant uses narrow deterministic queries, not a language model or unrestricted SQL. It reads only the verified company, stores user-private conversations and has no write tools. An external AI provider is intentionally optional and unconfigured.

## Test commands

```sh
npm run typecheck
npm test
npm run test:backend
npm run build
```

`test:backend` starts a disposable PostgreSQL instance on localhost port 55439 using a development-only embedded runner, applies the real migration, and removes the database afterward. It does not use Supabase or any configured production database. It tests relational constraints, lifecycle operations, rollback, stock concurrency, retries, tenant scoping, role denial, stale edits, jobs and assistant isolation. Do not run concurrent instances on the same port.

Browser/live UI tests mock network responses to verify form integration and failures. They do not prove the real Supabase login flow. Existing demo tests continue to exercise its separate local behavior.

## Deployment
Deploy both applications with Node-capable Next.js hosts; static `out/` hosting is no longer sufficient. From the repository root, `npm run build` builds both and `npm start` starts both on ports 3000/3001. For separate services, use `npm run build --workspace @nexus/frontend` / `npm run start --workspace @nexus/frontend` and the corresponding `@nexus/backend` commands. Keep the repository root lockfile and install workspace dependencies with `npm ci`. Set frontend public Auth variables and `BACKEND_URL` before building. Set backend database/Auth secrets and `APP_URL` at runtime; `APP_URL` must match the public frontend origin. The frontend host must reach `BACKEND_URL`. Forward cookies and Set-Cookie headers without caching authenticated API responses. Configure the scheduler against the backend `/api/jobs/run` endpoint (or the same path through the frontend proxy). Run reviewed migrations once per release before starting the new application. Avoid concurrent migration jobs. No deployment or GitHub push is performed automatically.

Use managed database backups and select a retention/PITR plan appropriate to the business. Before launch, restore a backup into a separate database, run integrity checks, and test application access against it. A backup that has not been restored is not verified. Never use migration reset as a rollback strategy; restore a verified snapshot or deploy a forward repair migration.

Server errors log an opaque request ID and error type, not request bodies or database credentials. Connect those logs to your monitoring provider and add availability/error-rate alerts. External monitoring and backups have not been provisioned here.

## Current limits / remaining launch checks
- No Supabase project is configured: real authentication and hosted database connectivity remain unverified.
- The interactive workspace explicitly caps each entity collection at 5,000 rows. It fails visibly rather than silently truncating analytics. A bounded paginated records API exists; the UI and browser exports still use the loaded ledger. Before exceeding this scale, wire server-side table filtering/sorting and streamed/job-based exports instead of raising the cap.
- Shared workspace saves reject version conflicts; reload before retrying a stale change. Team membership removal/ownership transfer, draft archival, and an audit-history browser are future admin work.
- Draft reviews have durable server history. Settings and alert decisions are shared across company members, not personal per-user settings. Compact table/sidebar preferences remain a UI concern.
- No external email, banking, tax engine, payment gateway, generalized AI or automatic recurring workflows are connected.
- No production seed/import is automatic. Use the UI to create test company records, or the isolated integration-test fixtures for repeatable fictional data.

Do not describe this as production-verified until the Supabase auth flows, deployment, backups/restore, monitoring and real-user acceptance checks have been completed.
