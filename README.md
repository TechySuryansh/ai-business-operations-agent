# Nexus — AI Business Operations frontend

A frontend-only SaaS workspace for the fictional **TechNova Distributors** electronics distribution company. Built with Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn-style Radix UI primitives, Lucide and Recharts.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Use the sidebar to explore each module. Navigation is reflected in URL hashes, so module links can be bookmarked and browser back/forward works.

```sh
npm run typecheck
npm test
npm run build
```

The production build produces a static site in `out/`. The build uses Webpack because the environment's sandbox blocks Turbopack's CSS worker from opening its internal port. `npm run dev` uses Next.js's default development bundler.

## Implemented modules

- **Overview:** computed metrics, revenue comparison chart, recent orders, top products, attention signals and activity.
- **AI Assistant:** supported questions use deterministic local calculations. Unsupported questions explain the demo limitation. Conversations persist locally.
- **Analytics:** seven/fourteen-day revenue comparisons, order totals, average order value, product and customer performance.
- **Customers, Sales, Inventory, Finance:** searchable tables, status filters, record details and CSV exports.
- **Alerts:** category filters, monitoring-rule reference and locally persisted reviewed state.
- **Automations:** enable/pause sample workflows, manually simulate draft generation, review and record a demo approval.
- **Reports:** previews and actual Excel `.xlsx`, PDF and CSV downloads containing source sample records. Export libraries load on demand.
- **Settings:** workspace name, compact table density, digest preference preview and local demo reset.
- **Global search:** find modules or records using the header or Cmd/Ctrl+K.

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

Light canvas, white cards, deep navy/charcoal ink, thin cool borders and restrained indigo accents. The spacing scale uses 4px steps. Cards have 8–10px corners; dialogs use 14px corners. Shared controls have visible focus states, and Radix dialogs provide focus trapping and keyboard dismissal. The sidebar becomes a mobile drawer, grids stack at tablet/mobile sizes, and tables scroll inside their cards.

## Data and integration boundary

**No backend APIs, database, authentication, live AI, payments, emails or external business integrations exist.** There are no credentials or environment variables to configure. Nothing is transmitted to an AI service.

- `src/data/mock-data.ts` is the read-only data source. Future API adapters should replace this boundary, rather than introducing fetch calls throughout components.
- `src/lib/demo-analytics.ts` computes business metrics from the mock arrays.
- `src/lib/demo-assistant.ts` uses explicitly supported keyword matching and deterministic calculations. It is not a general-purpose AI implementation.
- Workflow approval only changes local UI state. It never changes invoices, stock or orders and never sends messages.
- Browser local storage contains preferences, dismissed alerts, simulated drafts and conversations. Reset is available under Settings → Demo data.
- Source data represents **November 14, 2026**, in USD. Daily sales are aggregate data for November 1–14; recent orders are a smaller example list. Product/customer revenue are separate lifetime samples. These intentionally different data scopes are labeled in the UI.
- A digest toggle saves a preference only. No notification scheduling is implemented.

## Verification

The tests verify independently summed metrics, period filtering, customer references, assistant responses, real workbook/PDF creation, inventory search, approval state, navigation, local persistence and global search.

Browser visual QA was unavailable in the execution environment. Responsive layouts are implemented in CSS, but their rendered appearance still needs a real desktop/tablet/mobile browser review.

The ExcelJS UUID dependency is overridden to a compatible patched v11 version. ExcelJS only uses its v4 export; the workbook round-trip test verifies report compatibility.
