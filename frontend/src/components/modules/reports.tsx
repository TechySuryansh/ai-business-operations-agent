'use client';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/shared';
import { exportReport, type ExportFormat } from '@/lib/report-export';
import { useBusiness, exportName, type BusinessRecord } from '@/lib/business-context';
import { money, date } from '@/lib/utils';
import { collection, type RecordKind } from './records';
interface Config {
  kind: RecordKind;
  status: string;
  from: string;
  to: string;
  hidden: string[];
  format: ExportFormat;
}
const defaults: Config = {
  kind: 'Sales',
  status: 'All',
  from: '',
  to: '',
  hidden: [],
  format: 'xlsx',
};
const label = (key: string) =>
  (
    ({
      id: 'Record ID',
      sku: 'SKU',
      revenue: 'Lifetime revenue',
      orders: 'Lifetime orders',
      sold: 'Units sold',
      lastOrder: 'Last order',
      reorder: 'Reorder threshold',
      price: 'Unit price',
    }) as Record<string, string>
  )[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
const numericColumns = [
  'amount',
  'price',
  'revenue',
  'orders',
  'sold',
  'stock',
  'reorder',
  'items',
];
const value = (key: string, v: unknown) =>
  ['amount', 'price', 'revenue'].includes(key)
    ? money(Number(v))
    : ['date', 'issued', 'due', 'lastOrder'].includes(key)
      ? date(String(v))
      : String(v);
export function Reports({ notify }: { notify: (s: string) => void }) {
  const { data, companyName, live } = useBusiness();
  const [config, setConfig] = useState<Config>(defaults);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ name: string; config: Config }[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('nexus-report-views') ?? '[]');
      if (Array.isArray(parsed))
        setSaved(
          parsed
            .filter(
              (v) =>
                typeof v?.name === 'string' &&
                v.config &&
                ['Sales', 'Customers', 'Inventory', 'Finance'].includes(v.config.kind) &&
                typeof v.config.status === 'string' &&
                typeof v.config.from === 'string' &&
                typeof v.config.to === 'string' &&
                Array.isArray(v.config.hidden) &&
                v.config.hidden.every((k: unknown) => typeof k === 'string') &&
                ['csv', 'pdf', 'xlsx'].includes(v.config.format),
            )
            .slice(0, 10),
        );
    } catch {
      notify('Saved report configurations could not be loaded.');
    }
  }, [notify]);
  const source: BusinessRecord[] = data[collection[config.kind]];
  const keys = Object.keys(source[0] ?? {}).filter(
    (k) =>
      !['companyId', 'version', 'createdAt', 'lines', 'payments', 'live'].includes(k) &&
      typeof (source[0] as unknown as Record<string, unknown>)?.[k] !== 'object',
  );
  const visibleKeys = keys.filter((k) => !config.hidden.includes(k));
  const dateKey =
    config.kind === 'Sales'
      ? 'date'
      : config.kind === 'Finance'
        ? 'issued'
        : config.kind === 'Customers'
          ? 'lastOrder'
          : null;
  const dateLabel =
    config.kind === 'Finance'
      ? 'Issue date'
      : config.kind === 'Customers'
        ? 'Last historical order'
        : 'Order date';
  const statuses =
    config.kind === 'Inventory'
      ? ['All', 'Low stock', 'Healthy']
      : config.kind === 'Sales'
        ? ['All', 'Processing', 'Shipped', 'Delivered', ...(live ? ['Cancelled'] : [])]
        : config.kind === 'Customers'
          ? ['All', 'Active', 'Inactive']
          : ['All', 'Paid', 'Pending', 'Overdue', ...(live ? ['Void'] : [])];
  const invalidRange = Boolean(config.from && config.to && config.from > config.to);
  const rows = invalidRange
    ? []
    : source.filter((row) => {
        const r = row as unknown as Record<string, string | number>;
        const status =
          'stock' in row ? (row.stock < row.reorder ? 'Low stock' : 'Healthy') : r.status;
        return (
          (config.status === 'All' || status === config.status) &&
          (!dateKey ||
            ((!config.from || r[dateKey] >= config.from) &&
              (!config.to || r[dateKey] <= config.to)))
        );
      });
  const totalKey =
    config.kind === 'Sales' || config.kind === 'Finance'
      ? 'amount'
      : config.kind === 'Customers'
        ? 'revenue'
        : 'stock';
  const total = rows.reduce(
    (sum, row) => sum + Number((row as unknown as Record<string, unknown>)[totalKey]),
    0,
  );
  const exportRows = rows.map((row) =>
    Object.fromEntries(visibleKeys.map((k) => [k, (row as unknown as Record<string, unknown>)[k]])),
  );
  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      await exportReport(
        `${exportName(companyName)}-${config.kind.toLowerCase()}-${config.status.toLowerCase().replaceAll(' ', '-')}`,
        exportRows,
        config.format,
        companyName,
        live
          ? `Company ledger | Generated ${new Date().toISOString().slice(0, 10)} | Currency: USD`
          : undefined,
      );
      notify(
        `${rows.length} ${config.kind.toLowerCase()} records downloaded as ${config.format.toUpperCase()}.`,
      );
    } catch {
      setError('The report could not be exported. Please try again.');
      notify('Report export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const save = (next: typeof saved) => {
    setSaved(next);
    try {
      localStorage.setItem('nexus-report-views', JSON.stringify(next));
      notify('Report configurations saved.');
    } catch {
      notify('Report configuration could not be saved.');
    }
  };
  const table = (
    <div className="table-scroll">
      <table>
        <caption>
          {companyName} · {config.kind} · {rows.length} matching records · USD
        </caption>
        <thead>
          <tr>
            {visibleKeys.map((k) => (
              <th
                scope="col"
                key={k}
                className={numericColumns.includes(k) ? 'numeric' : undefined}
              >
                {label(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exportRows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {visibleKeys.map((k) => (
                <td key={k} className={numericColumns.includes(k) ? 'numeric' : undefined}>
                  {value(k, row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="module-stack reports-layout">
      <div className="report-intro">
        <h2>Report configuration</h2>
        <p>Choose a dataset, apply filters and select the columns to export.</p>
      </div>
      <section className="panel settings-panel report-configuration" aria-busy={busy}>
        <div className="form-grid">
          <label className="field-label">
            Report dataset
            <select
              value={config.kind}
              onChange={(e) =>
                setConfig({
                  ...config,
                  kind: e.target.value as RecordKind,
                  status: 'All',
                  hidden: [],
                  from: '',
                  to: '',
                })
              }
            >
              {Object.keys(collection).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Status
            <select
              value={config.status}
              onChange={(e) => setConfig({ ...config, status: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {dateKey && (
            <>
              <label className="field-label">
                {dateLabel} from
                <input
                  type="date"
                  value={config.from}
                  onChange={(e) => setConfig({ ...config, from: e.target.value })}
                />
              </label>
              <label className="field-label">
                {dateLabel} to
                <input
                  type="date"
                  value={config.to}
                  onChange={(e) => setConfig({ ...config, to: e.target.value })}
                />
              </label>
            </>
          )}
          <label className="field-label">
            Export format
            <select
              value={config.format}
              onChange={(e) => setConfig({ ...config, format: e.target.value as ExportFormat })}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF document</option>
              <option value="csv">CSV spreadsheet</option>
            </select>
          </label>
          <label className="field-label">
            Saved configuration
            <select
              value=""
              onChange={(e) => {
                const found = saved.find((s) => s.name === e.target.value);
                if (found) setConfig(found.config);
              }}
            >
              <option value="">Choose a report</option>
              {saved.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
        <details className="report-advanced">
          <summary>
            Columns & saved reports <span>{visibleKeys.length} columns</span>
          </summary>
          <fieldset className="report-columns">
            <legend>Included columns</legend>
            {keys.map((k) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={!config.hidden.includes(k)}
                  onChange={() =>
                    setConfig({
                      ...config,
                      hidden: config.hidden.includes(k)
                        ? config.hidden.filter((c) => c !== k)
                        : [...config.hidden, k],
                    })
                  }
                />
                {label(k)}
              </label>
            ))}
          </fieldset>
          <form
            className="save-report"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              save(
                [
                  ...saved.filter((s) => s.name !== name.trim()),
                  { name: name.trim(), config },
                ].slice(-10),
              );
              setName('');
            }}
          >
            <input
              aria-label="Report configuration name"
              maxLength={40}
              placeholder="Name this report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!name.trim()}>
              Save configuration
            </Button>
            {saved.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => save([])}>
                Clear saved reports
              </Button>
            )}
          </form>
        </details>
        {invalidRange && (
          <p className="form-error" role="alert">
            The end date must be on or after the start date.
          </p>
        )}
        {!visibleKeys.length && (
          <p className="form-error" role="alert">
            Select at least one column.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="report-summary" role="status">
          <strong>{rows.length} records</strong>
          <span>
            {config.kind === 'Inventory'
              ? `${total} units in stock`
              : `${money(total)} ${config.kind === 'Customers' ? 'lifetime sample revenue' : 'total value'}`}
          </span>
        </div>
        <div className="dialog-actions">
          <Button
            variant="outline"
            disabled={!rows.length || !visibleKeys.length}
            onClick={() => setPreview(true)}
          >
            Preview report
          </Button>
          <Button disabled={busy || !rows.length || !visibleKeys.length} onClick={generate}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />}
            {busy ? 'Exporting report…' : `Download ${config.format.toUpperCase()}`}
          </Button>
        </div>
      </section>
      <section className="panel report-table">
        <div className="report-preview-heading">
          <h2>Data preview</h2>
          <span>{rows.length} matching records</span>
        </div>
        {rows.length && visibleKeys.length ? (
          table
        ) : (
          <Empty
            title="No report records"
            description="Adjust your filters or select columns to preview data."
          />
        )}
      </section>
      <p className="demo-note">
        {live
          ? 'Company records · USD. Customer revenue is booked order value. The export matches the filters and columns shown above.'
          : 'Local ledger as originally sampled on Nov 14, 2026, plus your edits. Customer revenue is a lifetime sample. Daily aggregate analytics are exported separately from Analytics.'}
      </p>
      <Dialog
        open={preview}
        onOpenChange={setPreview}
        title={`${config.kind} report`}
        description={`${rows.length} matching records. Downloads use the same filters and included columns.`}
      >
        {table}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setPreview(false)}>
            Close
          </Button>
          <Button disabled={busy} onClick={generate}>
            {busy ? 'Exporting report…' : `Download ${config.format.toUpperCase()}`}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
