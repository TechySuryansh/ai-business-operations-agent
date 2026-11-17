'use client';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/backend-client';
import { useBusiness } from '@/lib/business-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
interface Draft {
  id: string;
  title: string;
  body: string;
  status: string;
  reason?: string;
  history?: { at: string; action: string }[];
}
export function LiveAutomations({
  onState,
}: {
  onState?: (state: { version: number; data: unknown }) => void;
}) {
  const { live } = useBusiness();
  const [state, setState] = useState<{
    version: number;
    data: { drafts: Draft[]; workflows?: { category: string; enabled: boolean }[] };
  } | null>(null);
  const [jobs, setJobs] = useState<
    { id: string; kind: string; status: string; attempts: number; error?: string }[]
  >([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const request = useRef<{ kind: string; key: string } | null>(null);
  const load = async () => {
    const [workspace, loadedJobs] = await Promise.all([
      api<typeof state>(`${live!.company.id}/workspace`),
      api<typeof jobs>(`${live!.company.id}/jobs`),
    ]);
    setState(workspace);
    setJobs(loadedJobs);
    if (workspace) onState?.(workspace);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function run(kind: string) {
    setBusy(true);
    setError('');
    if (request.current?.kind !== kind) request.current = { kind, key: crypto.randomUUID() };
    try {
      await api(`${live!.company.id}/jobs`, { kind, key: request.current.key });
      request.current = null;
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(kind: string) {
    setBusy(true);
    setError('');
    const enabled =
      state?.data.workflows?.find((w) => w.category === kind)?.enabled ?? kind !== 'Sales';
    try {
      await api(`${live!.company.id}/workflow-toggle`, {
        kind,
        enabled: !enabled,
        version: state?.version ?? 0,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(status: string) {
    if (!selected || !state) return;
    setBusy(true);
    try {
      await api(`${live!.company.id}/draft-review`, {
        id: selected.id,
        version: state.version,
        status,
        body,
        reason,
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="module-stack">
      <p className="callout">
        Generate review drafts from company records. Approval records a decision; it does not send
        emails, place orders or move money.
      </p>
      {error && <p role="alert">{error}</p>}
      <section className="panel settings-section">
        <h2>Generate a draft</h2>
        <div className="dialog-actions">
          {['Inventory', 'Finance', 'Sales'].map((kind) => (
            <Button
              key={kind}
              variant="ghost"
              disabled={busy || live?.role === 'staff'}
              onClick={() => toggle(kind)}
            >
              {kind}:{' '}
              {(state?.data.workflows?.find((w) => w.category === kind)?.enabled ??
              kind !== 'Sales')
                ? 'Enabled · pause'
                : 'Paused · enable'}
            </Button>
          ))}
        </div>
        <div className="dialog-actions">
          {['Inventory', 'Finance', 'Sales'].map((kind) => (
            <Button
              key={kind}
              disabled={busy || live?.role === 'staff'}
              variant="outline"
              onClick={() => run(kind)}
            >
              {kind} review
            </Button>
          ))}
          <Button variant="ghost" onClick={() => load().catch((e) => setError(e.message))}>
            Refresh
          </Button>
        </div>
      </section>
      <section className="panel settings-section">
        <h2>Review history</h2>
        {!state?.data.drafts.length && <p>No drafts yet.</p>}
        {state?.data.drafts.map((d) => (
          <div className="alert-row" key={d.id}>
            <div>
              <strong>{d.title}</strong>
              <p>{d.status}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(d);
                setBody(d.body);
                setReason(d.reason ?? '');
              }}
            >
              Open draft
            </Button>
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <h2>Job history</h2>
        {jobs.map((j) => (
          <p key={j.id}>
            {j.kind} · {j.status} · {j.attempts} attempts {j.error ? `· ${j.error}` : ''}
          </p>
        ))}
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? 'Draft'}
      >
        <div className="record-form">
          <label className="field-label">
            Draft
            <textarea
              rows={10}
              value={body}
              readOnly={selected?.status !== 'Needs review'}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {selected?.history?.map((h, i) => (
            <p key={i}>
              {h.at} · {h.action}
            </p>
          ))}
          {selected?.status === 'Needs review' && (
            <>
              <label className="field-label">
                Rejection reason
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="dialog-actions">
                {['Needs review', 'Approved', 'Rejected'].map((status) => (
                  <Button
                    key={status}
                    disabled={busy || live?.role === 'staff'}
                    onClick={() => review(status)}
                  >
                    {status === 'Needs review'
                      ? 'Save edits'
                      : status === 'Approved'
                        ? 'Approve draft'
                        : 'Reject'}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
