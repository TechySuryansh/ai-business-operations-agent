# Nexus — AI Business Operations frontend

A frontend-only SaaS workspace for the fictional **TechNova Distributors** electronics distribution company. Built with Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn-style Radix UI primitives, Lucide and Recharts.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Use the sidebar to explore each module. Navigation, record details, table searches, status filters, sorting, pagination and column preferences are reflected in URL hashes. Module and record views can be bookmarked; browser back/forward works.

```sh
npm run typecheck
npm test
npm run build
```

The production build produces a static site in `out/`. The build uses Webpack because the environment's sandbox blocks Turbopack's CSS worker from opening its internal port. `npm run dev` uses Next.js's default development bundler.

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
src/
  app/                     App Router page, layout, global design styles
  components/
    ui/                    Shared button, dialog, badge, search and empty states
    layout/                Navigation and workspace sidebar
    dashboard/             Overview and reusable Recharts visualizations
    modules/               Business views
    workspace.tsx          Client workspace composition and state
  data/mock-data.ts        All fictional business records and sample copy
  lib/                     Deterministic analytics, assistant, exports, formatting
  types/business.ts        Typed business entities
 tests/                    Calculation, export and React interaction tests
```

## Design system

The application uses locally hosted Geist typography, charcoal text, a white working canvas, neutral navigation and one cobalt action color. Shared controls follow a consistent size and spacing scale. Borders define working surfaces; shadows are limited to dialogs and notifications.

Each module uses a layout suited to its task: grouped dashboard metrics, dense record tables, workflow/exception rows, a report configuration/preview split, and an analysis workspace with source context. Advanced table and report controls use disclosures to keep primary actions visible. No dependencies were added for the redesign.

See [DESIGN.md](DESIGN.md) for the component, typography, spacing and responsive conventions.

## Data and integration boundary

**No backend APIs, database, authentication, live AI, payments, emails or external business integrations exist.** There are no credentials or environment variables to configure. Nothing is transmitted to an AI service.

- `src/data/mock-data.ts` provides the original samples. `src/lib/business-context.tsx` owns validated, persisted local record edits and a capped activity history. Future API adapters should replace this boundary rather than introducing fetch calls throughout components.
- `src/lib/demo-analytics.ts` computes business metrics from the mock arrays.
- `src/lib/demo-assistant.ts` uses explicitly supported keyword matching and deterministic calculations. It is not a general-purpose AI implementation.
- Workflow approval only changes local UI state. It never changes invoices, stock or orders and never sends messages.
- Browser local storage contains edited records, activity, preferences, reviewed/snoozed alerts, saved table/report views, simulated drafts and conversations. Reset under Settings → Demo data clears all local changes and restores the original samples. Storage failures are surfaced in the UI.
- Source data represents **November 14, 2026**, in USD. Daily sales are aggregate data for November 1–14; recent orders are a smaller example list. Product/customer revenue are separate lifetime samples. These intentionally different data scopes are labeled in the UI. Local order edits do not rewrite historical daily sales or lifetime sample totals. Customer renames update linked local order and invoice references. Invoices are linked by customer; no order-to-invoice relationship is fabricated.
- A digest toggle saves a preference only. No notification scheduling is implemented.

## Verification

The 26 automated tests cover metric totals and scopes, customer references, persistence validation, currency precision, assistant periods/conversations, workbook/PDF creation, table sorting/pagination/saved views, record creation/rename, payments and reload persistence, alerts, contextual navigation, editable/rejected drafts and report filters.

Browser QA checks all 11 modules at 1440, 1024, 768, 390 and 320px widths. Desktop and mobile screenshots were inspected. Keyboard checks cover mobile drawer focus trapping, Escape/focus restoration, record details, command search and persisted sidebar collapse. Browser QA uses an isolated headless Chrome profile; no user browser data is accessed.

The ExcelJS UUID dependency is overridden to a compatible patched v11 version. ExcelJS only uses its v4 export; the workbook round-trip test verifies report compatibility.
