# Nexus — Business Operations workspace

A SaaS workspace with a Next.js/PostgreSQL backend and a separate fictional **TechNova Distributors** demo. Built with Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn-style Radix UI primitives, Lucide and Recharts.

## Run locally

```sh
npm ci
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Fill in your Supabase and database values, then:
npm run db:migrate
npm run dev
```

`npm run dev` starts the frontend on port **3000** and backend on port **3001**. Use `npm run dev:frontend` or `npm run dev:backend` to run either separately. The demo works without external credentials; skip environment setup and migrations to explore it.

Open http://127.0.0.1:3000 for the live application or `/demo` for the original fictional workspace. See [BACKEND_SETUP.md](BACKEND_SETUP.md) for database and Supabase Auth configuration. Use the sidebar to explore each module. Navigation, record details, table searches, status filters, sorting, pagination and column preferences are reflected in URL hashes. Module and record views can be bookmarked; browser back/forward works.

```sh
npm run typecheck
npm test
npm run build
```

The production build requires a Node-capable host; run both applications with `npm start`. Static export is no longer enabled. The build uses Webpack because the environment's sandbox blocks Turbopack's CSS worker from opening its internal port. `npm run dev` uses Next.js's default development bundler.

For hosted setup and operational commands, see [DEPLOYMENT.md](DEPLOYMENT.md). Run `npm run setup:env` to create local environment files without overwriting existing values, and `npm run setup:check` to check what remains unconfigured.

## Implemented modules

- **Overview:** computed metrics with explicit time scopes, historical revenue comparisons, recent orders, product links, attention signals, a work queue and local activity. Decorative sparklines and repeated assistant promotions have been removed.
- **AI Assistant:** period-aware deterministic calculations from current local records, linked source records, multiline input, copy controls and locally archived conversations. Unsupported questions explain the demo limitation.
- **Analytics:** seven/fourteen-day revenue comparisons, order totals, average order value, product and customer performance.
- **Customers, Sales, Inventory, Finance:** validated local create/edit flows, stock adjustments and confirmed full-payment recording; searchable/sortable tables with pagination, column controls, selection, filtered/selected CSV export and saved views. Dedicated details include formatted values, customer-linked orders/invoices and a local activity trail.
- **Alerts:** computed from local records, with category/status filters, contextual actions, reviewed history, undo, restore and persisted one-hour snoozing.
- **Automations:** enable/pause sample workflows, generate drafts from current local records, edit drafts, approve or reject with a reason, and inspect timestamped review history. Finance drafts honor the more-than-seven-days overdue rule.
- **Reports:** a report builder with date/status filters, selectable columns, saved configurations, matching table previews and real Excel `.xlsx`, PDF and CSV downloads. PDF exports include repeated headers and page numbers. Export libraries load on demand.
- **Settings:** consistent workspace branding, activity time zone, compact table density, digest preference preview, connection status and local demo reset. The sidebar can collapse on desktop; the mobile drawer traps focus and restores it on dismissal.
- **Global search:** find modules or records using the header or Cmd/Ctrl+K, with automatic search focus and arrow-key result navigation.

## Structure

```text
frontend/                 Next.js UI application (port 3000)
  src/app/                Pages, layouts, login and auth callback
  src/components/         Dashboard, modules, navigation and controls
  src/lib/                UI state, demo analytics, exports and auth helpers
  src/data/               Fictional demo records
  src/types/              UI business entities
  tests/                  UI, analytics and export tests
  .env.example            Public Supabase settings and backend destination
backend/                  Next.js API application (port 3001)
  src/app/api/            Business endpoints and job runner
  src/server/             Auth checks, business services, jobs and database client
  src/lib/supabase/       Server-only Supabase session helper
  prisma/                 Database schema and SQL migrations
  tests/                  Business rules and PostgreSQL integration checks
  .env.example            Database, server auth settings and job secret
scripts/run-apps.mjs       Starts and stops both applications together
package.json              Workspace commands
package-lock.json         Shared dependency lockfile
```

Each application owns its package manifest, TypeScript/Next.js configuration and environment file. Run `npm ci` from the repository root. Frontend requests to `/api/*` are forwarded to `BACKEND_URL`, retaining the same-origin cookie login flow. Only the backend receives database credentials. Neither app imports the other app’s source.

## Design system

The application uses locally hosted Geist typography, charcoal text, a white working canvas, neutral navigation and one cobalt action color. Shared controls follow a consistent size and spacing scale. Borders define working surfaces; shadows are limited to dialogs and notifications.

Each module uses a layout suited to its task: grouped dashboard metrics, dense record tables, workflow/exception rows, a report configuration/preview split, and an analysis workspace with source context. Advanced table and report controls use disclosures to keep primary actions visible. No dependencies were added for the redesign.

See [DESIGN.md](DESIGN.md) for the component, typography, spacing and responsive conventions.

## Data and integration boundary

The live app uses Supabase Auth, company-scoped Next.js APIs, Prisma and PostgreSQL. Orders have line items and atomic stock deductions; invoices and manual payments preserve financial history. Shared settings, alerts, draft jobs, approvals and private assistant conversations are persisted server-side. The assistant uses deterministic company-data queries; no external AI or payment gateway is connected.

The original `/demo` retains its localStorage records and fictional November 14, 2026 analytics. It never automatically seeds a live company. Live failures never silently fall back to mock data.

See [BACKEND_PLAN.md](BACKEND_PLAN.md) for the design and [BACKEND_SETUP.md](BACKEND_SETUP.md) for credentials, migrations, permissions, testing, deployment, limitations and remaining launch checks. No Supabase project or production infrastructure is provisioned automatically.

## Verification

Automated tests cover metric totals and scopes, customer references, persistence validation, currency precision, assistant periods/conversations, workbook/PDF creation, table sorting/pagination/saved views, record creation/rename, payments and reload persistence, alerts, contextual navigation, editable/rejected drafts and report filters.

The frontend redesign browser QA checked all 11 demo modules at 1440, 1024, 768, 390 and 320px widths. Desktop and mobile screenshots were inspected. Keyboard checks cover mobile drawer focus trapping, Escape/focus restoration, record details, command search and persisted sidebar collapse. Browser QA uses an isolated headless Chrome profile; no user browser data is accessed.

The ExcelJS UUID dependency is overridden to a compatible patched v11 version. ExcelJS only uses its v4 export; the workbook round-trip test verifies report compatibility.

Backend verification: `npm run test:backend` runs isolated real PostgreSQL checks. `npm test` includes backend rules and mocked live-form integration checks. Real Supabase authentication requires a configured project and separate end-to-end verification.

OpenAI assistant configuration and verification: [OPENAI_SETUP.md](./OPENAI_SETUP.md).
