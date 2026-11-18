'use client';
import { useEffect, useState, useRef } from 'react';
import { api, RequestError } from '@/lib/backend-client';
import { useBusiness } from '@/lib/business-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
type Schedule = 'off' | 'daily' | 'weekly';
interface Draft {
  archivedAt?: string;
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
    data: {
      drafts: Draft[];
      workflows?: { category: string; enabled: boolean; schedule?: Schedule }[];
    };
  } | null>(null);
  const [jobs, setJobs] = useState<
    { id: string; kind: string; status: string; attempts: number; error?: string }[]
  >([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [archive, setArchive] = useState<{ drafts: Draft[]; next: string | null }>();
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const archiveCursor = useRef<string | undefined>(undefined);
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const request = useRef<{ kind: string; key: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);
  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [workspace, loadedJobs] = await Promise.all([
        api<typeof state>(`${live!.company.id}/workspace`),
        api<typeof jobs>(`${live!.company.id}/jobs`),
      ]);
      setState(workspace);
      setJobs(loadedJobs);
      if (workspace) onStateRef.current?.(workspace);
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function submit(path: string, payload: object, key: string, done?: () => void) {
    setBusy(true);
    setError('');
    setRetryAction(null);
    try {
      await api(`${live!.company.id}/${path}`, payload, key);
      done?.();
      await load();
    } catch (error) {
      setError((error as Error).message);
      if (error instanceof RequestError && error.retryable) {
        setRetryAction(() => () => submit(path, payload, key, done));
      }
    } finally {
      setBusy(false);
    }
  }
  async function loadArchive(after?: string) {
    archiveCursor.current = after;
    setArchiveLoading(true);
    setArchiveError('');
    try {
      const query = after ? '?' + new URLSearchParams({ after }) : '';
      const page = await api<{ drafts: Draft[]; next: string | null }>(
        `${live!.company.id}/draft-archive${query}`,
      );
      setArchive((previous) => ({
        drafts: after ? [...(previous?.drafts ?? []), ...page.drafts] : page.drafts,
        next: page.next,
      }));
    } catch (error) {
      setArchiveError((error as Error).message);
    } finally {
      setArchiveLoading(false);
    }
  }
  function openDraft(draft: Draft) {
    setRetryAction(null);
    setError('');
    setSelected(draft);
    setBody(draft.body);
    setReason(draft.reason ?? '');
  }
  function archiveSelected() {
    if (!selected || !state || selected.archivedAt) return;
    void submit(
      'draft-archive',
      { id: selected.id, version: state.version },
      crypto.randomUUID(),
      () => {
        setSelected(null);
        if (archive) void loadArchive();
      },
    );
  }
  function run(kind: string) {
    if (request.current?.kind !== kind) request.current = { kind, key: crypto.randomUUID() };
    void submit('jobs', request.current, request.current.key, () => {
      request.current = null;
    });
  }
  function toggle(kind: string, schedule?: Schedule) {
    const enabled =
      state?.data.workflows?.find((w) => w.category === kind)?.enabled ?? kind !== 'Sales';
    void submit(
      'workflow-toggle',
      {
        kind,
        enabled: schedule === undefined ? !enabled : enabled,
        schedule,
        version: state?.version ?? 0,
      },
      crypto.randomUUID(),
    );
  }
  function review(status: string) {
    if (!selected || !state) return;
    void submit(
      'draft-review',
      {
        id: selected.id,
        version: state.version,
        status,
        body,
        reason,
      },
      crypto.randomUUID(),
      () => setSelected(null),
    );
  }
  const actionError = error && (
    <div role="alert">
      {error}{' '}
      {retryAction ? (
        <Button disabled={busy} onClick={retryAction}>
          Retry automation request
        </Button>
      ) : (
        <Button disabled={loading || busy} onClick={load}>
          Refresh automation data
        </Button>
      )}
    </div>
  );
  return (
    <div className="module-stack">
      <p className="callout">
        Manual and recurring runs create drafts for review. Email delivery is disconnected.
      </p>
      {!selected && actionError}
      {loadError && (
        <div role="alert">
          {loadError}{' '}
          <Button disabled={loading || busy} onClick={load}>
            Retry loading automations
          </Button>
        </div>
      )}
      <section className="panel settings-section">
        <h2>Workflows</h2>
        <p>Schedules use company time. Runs start from 9:00 AM daily or on Mondays.</p>
        <div className="record-form">
          {['Inventory', 'Finance', 'Sales'].map((kind) => (
            <label key={kind} className="field-label">
              {kind} schedule
              <select
                disabled={busy || loading || live?.role === 'staff'}
                value={state?.data.workflows?.find((w) => w.category === kind)?.schedule ?? 'off'}
                onChange={(event) => toggle(kind, event.target.value as Schedule)}
              >
                <option value="off">Off</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly on Monday</option>
              </select>
            </label>
          ))}
        </div>
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
          <Button variant="ghost" disabled={loading || busy} onClick={load}>
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
            <Button variant="outline" onClick={() => openDraft(d)}>
              Open draft
            </Button>
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <h2>Archived drafts</h2>
        {!archive && (
          <Button disabled={archiveLoading} onClick={() => loadArchive()}>
            Load archive
          </Button>
        )}
        {archiveError && (
          <div role="alert">
            {archiveError}{' '}
            <Button disabled={archiveLoading} onClick={() => loadArchive(archiveCursor.current)}>
              Retry loading archive
            </Button>
          </div>
        )}
        {archive && !archive.drafts.length && <p>No archived drafts.</p>}
        {archive?.drafts.map((draft) => (
          <div className="alert-row" key={draft.id}>
            <span>
              {draft.title} · {draft.status}
            </span>
            <Button variant="outline" onClick={() => openDraft(draft)}>
              View archived draft
            </Button>
          </div>
        ))}
        {archive?.next && (
          <Button disabled={archiveLoading} onClick={() => loadArchive(archive.next!)}>
            Load more archived drafts
          </Button>
        )}
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
        onOpenChange={(open) => !open && !busy && setSelected(null)}
        title={selected?.title ?? 'Draft'}
      >
        <div className="record-form">
          {actionError}
          <label className="field-label">
            Draft
            <textarea
              rows={10}
              value={body}
              readOnly={busy || !!selected?.archivedAt || selected?.status !== 'Needs review'}
              onChange={(e) => {
                setBody(e.target.value);
                setRetryAction(null);
                setError('');
              }}
            />
          </label>
          {selected && !selected.archivedAt && live?.role !== 'staff' && (
            <Button variant="outline" disabled={busy || loading} onClick={archiveSelected}>
              Archive draft
            </Button>
          )}
          {selected?.history?.map((h, i) => (
            <p key={i}>
              {h.at} · {h.action}
            </p>
          ))}
          {selected?.status === 'Needs review' && !selected.archivedAt && (
            <>
              <label className="field-label">
                Rejection reason
                <input
                  disabled={busy}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setRetryAction(null);
                    setError('');
                  }}
                />
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
