'use client';
import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Table2,
} from 'lucide-react';
import { reportTemplates } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/shared';
import { exportReport, type ExportFormat } from '@/lib/report-export';
export function Reports({ notify }: { notify: (s: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [busy, setBusy] = useState<string | null>(null);
  const generate = async (index: number) => {
    const report = reportTemplates[index];
    setBusy(report.title);
    try {
      await exportReport(`technova-${report.category.toLowerCase()}-report`, report.rows, format);
      notify(`${report.title} downloaded as ${format.toUpperCase()}.`);
    } catch {
      notify('The report could not be exported. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  const preview = selected === null ? null : reportTemplates[selected];
  return (
    <div className="module-stack">
      <div className="report-banner">
        <div className="report-banner-icon">
          <FileSpreadsheet size={28} />
        </div>
        <div>
          <span className="eyebrow">FROM DATA TO DECISIONS</span>
          <h2>The right numbers. Ready to share.</h2>
          <p>Download a clear snapshot of your business in Excel, PDF or CSV.</p>
        </div>
        <label className="export-format">
          Export format
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF document</option>
            <option value="csv">CSV spreadsheet</option>
          </select>
        </label>
      </div>
      <div className="report-grid">
        {reportTemplates.map((report, i) => (
          <section key={report.title} className="panel report-card">
            <div className="report-card-top">
              <span className="report-icon">
                {i === 0 ? (
                  <FileSpreadsheet size={22} />
                ) : i === 1 ? (
                  <Table2 size={22} />
                ) : (
                  <FileText size={22} />
                )}
              </span>
              <Badge tone="neutral">{report.category}</Badge>
            </div>
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <div className="report-meta">
              {report.rows.length} sample records <span>·</span> Nov 14, 2026 snapshot
            </div>
            <div className="report-actions">
              <Button variant="outline" onClick={() => setSelected(i)}>
                Preview
                <ArrowUpRight size={14} />
              </Button>
              <Button onClick={() => generate(i)} disabled={!!busy}>
                {busy === report.title ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <ArrowDownToLine size={14} />
                )}
                Download
              </Button>
            </div>
          </section>
        ))}
      </div>
      <div className="demo-note">
        <FileText size={14} />
        Reports export actual sample records. Recent order samples are distinct from daily aggregate
        analytics.
      </div>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={preview?.title ?? 'Report preview'}
        description="A preview of the first three records. Downloads include every record in this report."
      >
        {preview && (
          <>
            <div className="report-preview">
              {preview.rows.slice(0, 3).map((row) => (
                <div key={row.id}>
                  {Object.entries(row)
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <p key={k}>
                        <span>{k}</span>
                        <strong>{String(v)}</strong>
                      </p>
                    ))}
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button disabled={!!busy} onClick={() => selected !== null && generate(selected)}>
                <ArrowDownToLine size={15} />
                Download {format.toUpperCase()}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
