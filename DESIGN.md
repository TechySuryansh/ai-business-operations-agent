# Nexus UI system

Nexus is an operations workspace. Layouts prioritize records, comparisons and decisions over promotional content.

## Foundations

- Self-hosted Geist, loaded with `next/font/local`; the bundled font's license is in `frontend/src/app/fonts/LICENSE.txt`.
- Type scale: 12px supporting text, 13px body/controls, 14–16px section titles, 23px page titles, 27–32px KPI values. Numbers use tabular figures.
- Spacing scale: 4, 8, 12, 16, 24 and 32px.
- White working canvas, neutral navigation surface, charcoal text, cobalt primary actions. Green, amber and red communicate business status only.
- 4–6px corners for controls and panels. Shadows are reserved for dialogs and transient notifications.
- The shared tokens and component styles live in `frontend/src/app/globals.css`, organized by component and responsive breakpoint.

## Page composition

- Overview: grouped KPI strip, short period summary, primary revenue chart, exception rail and supporting operational records.
- Record modules: contextual metric strip, search/status toolbar, advanced view disclosure, aligned data table and pagination.
- Analytics: aggregate metrics and complementary charts with accessible data-table disclosures.
- Assistant: contextual data rail, suggested analyses, document-style results and source records. On phones, the question/result surface precedes supporting context.
- Alerts: review-status navigation and a separate category filter, followed by exception rows.
- Automations: workflow rows with enable state, execution metadata and review actions.
- Reports: configuration beside the data preview, with advanced column/saved-report options disclosed on demand. Small screens stack the two surfaces.
- Settings: secondary navigation alongside conventional labeled forms.

## Interaction rules

Use consistent focus outlines, restrained hover surfaces and explicit disabled states. Preserve keyboard focus trapping and restoration in dialogs and the mobile drawer. Tables scroll within their own containers; page-level overflow is a defect. Reduce columns and stack sections before reducing text size. Mobile form text is 16px to avoid browser input zoom.

Dates and business figures retain their explicit sample scopes. UI polish does not imply that authentication, live AI or external business integrations are connected.
