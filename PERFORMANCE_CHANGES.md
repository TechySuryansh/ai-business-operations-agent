# Performance changes

- Assistant requests no longer invoke the full workspace snapshot. Topic-specific SQL reads fetch low-stock records, invoice balances, customer ranking, or 28 daily sales aggregates. Follow-ups reuse recent user intent. Lists are limited to 20; aggregate totals are not limited to those lists.
- Backend API routes verify the user with getUser and refresh cookies in the Route Handler. The redundant backend proxy has been removed. Company membership is still read from the database on every scoped request. The frontend proxy uses verified claims for refresh; protected pages still use getUser. No caller-supplied identity header is trusted.
- Commands return their saved result plus a patch of affected records and audit entries. Orders update their related customer/product totals and daily sales; customer renames update related order/invoice labels; invoice/payment changes update only the affected invoice. A patch read failure reports that the save succeeded and asks for a refresh. It does not automatically repeat the write.
- Live record tables use debounced server-side filtering, validated sorting and pagination (maximum 100 rows per request). Outdated responses are ignored. CSV exports traverse all matching pages rather than silently exporting only the displayed page.
- Snapshot calculations build daily, customer and product indexes in one pass. Unused invoice line items are no longer fetched.

## Remaining boundary

The initial workspace bootstrap and explicit Refresh still load the complete ledger because dashboard summaries, global search, record selectors and report generation currently consume it. The former 5,000-row rejection is removed, but this is not unlimited-scale architecture. Very large workspaces need dedicated aggregate, search, record-picker and report/export endpoints before initial loading can be bounded without changing totals. No production latency percentage is claimed; authenticated browser/network measurements are still needed.

Validation covers paginated counts/filtering/sorting, invalid sort rejection, company isolation, projection parity, renamed dependent records, timezone-aware aggregates, targeted assistant context, incremental client saves and live table pagination. Existing financial lifecycle and AI tests remain applicable.
