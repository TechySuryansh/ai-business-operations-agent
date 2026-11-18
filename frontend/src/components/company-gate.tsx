'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/backend-client';
import { Workspace } from './workspace';
import { Button } from './ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { LiveBootstrap } from '@/lib/business-context';
export function CompanyGate() {
  const [companies, setCompanies] = useState<{ company: { id: string; name: string } }[] | null>(
    null,
  );
  const [bootstrap, setBootstrap] = useState<LiveBootstrap | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [companyToRetry, setCompanyToRetry] = useState<string>();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const rows = await api<{ company: { id: string; name: string } }[]>('companies');
      setCompanies(rows);
      if (rows.length === 1) await choose(rows[0].company.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = async (id: string) => {
    setCompanyToRetry(id);
    setBusy(true);
    setError('');
    try {
      const [snapshot, workspace] = await Promise.all([
        api<LiveBootstrap>(`${id}/snapshot`),
        api<LiveBootstrap['workspace']>(`${id}/workspace`),
      ]);
      setBootstrap({ ...snapshot, workspace });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  if (bootstrap) return <Workspace live={bootstrap} />;
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <h1>Your workspace</h1>
        {error && <p role="alert">{error}</p>}
        {error && companyToRetry && (
          <Button disabled={busy} onClick={() => choose(companyToRetry)}>
            Retry opening workspace
          </Button>
        )}
        {companies === null ? (
          <Button
            disabled={busy}
            onClick={() => {
              setError('');
              void load();
            }}
          >
            {busy ? 'Loading…' : error ? 'Retry loading companies' : 'Load companies'}
          </Button>
        ) : companies.length ? (
          companies.map(({ company }) => (
            <Button key={company.id} disabled={busy} onClick={() => choose(company.id)}>
              {company.name}
            </Button>
          ))
        ) : (
          <form
            className="record-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const company = await api<{ id: string }>('companies', { name });
                await choose(company.id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>Create your company to start with an empty ledger.</p>
            <label className="field-label">
              Company name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <Button disabled={busy || !!companyToRetry}>
              {error ? 'Retry creating company' : 'Create company'}
            </Button>
          </form>
        )}
        <Button
          variant="ghost"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            window.location.assign('/login');
          }}
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
