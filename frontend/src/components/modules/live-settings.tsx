'use client';
import { useRef, useState } from 'react';
import { useBusiness } from '@/lib/business-context';
import { api } from '@/lib/backend-client';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import type { Preferences } from './settings';
export function LiveSettings({
  preferences,
  onSave,
  notify,
}: {
  preferences: Preferences;
  onSave: (p: Preferences) => void;
  notify: (s: string) => void;
}) {
  const { live } = useBusiness();
  const [form, setForm] = useState(preferences);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [membershipError, setMembershipError] = useState('');
  const membershipRequest = useRef<{ payload: string; key: string } | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  return (
    <div className="module-stack">
      <section className="panel settings-section">
        <h2>Company settings</h2>
        <form
          className="record-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <label className="field-label">
            Company name
            <input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            Timezone
            <select
              value={form.timeZone}
              onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
            >
              {['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <p>Currency: USD. Email delivery and external integrations are not connected.</p>
          <Button disabled={live?.role !== 'owner'}>Save company settings</Button>
        </form>
      </section>
      {live?.role === 'owner' && (
        <section className="panel settings-section">
          <h2>Team access</h2>
          <p>
            Add an existing registered application user to this company. Invitations by email are
            not sent.
          </p>
          <form
            className="record-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setMembershipError('');
              const payload = JSON.stringify({ email, role });
              if (membershipRequest.current?.payload !== payload) {
                membershipRequest.current = { payload, key: crypto.randomUUID() };
              }
              try {
                await api(
                  `${live.company.id}/members`,
                  { email, role },
                  membershipRequest.current.key,
                );
                membershipRequest.current = undefined;
                notify('Company membership saved.');
                setEmail('');
              } catch (e) {
                setMembershipError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              User email
              <input
                type="email"
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field-label">
              Role
              <select disabled={busy} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="staff">Staff · read company data and manage customers</option>
                <option value="manager">Manager · manage records and financial operations</option>
              </select>
            </label>
            {membershipError && <p role="alert">{membershipError}</p>}
            <Button disabled={busy}>
              {busy ? 'Saving…' : membershipError ? 'Retry membership save' : 'Save membership'}
            </Button>
          </form>
        </section>
      )}
      <section className="panel settings-section">
        <h2>Account</h2>
        <p>Your role: {live?.role}. Sessions are managed by Supabase Auth.</p>
        <Button
          variant="outline"
          onClick={async () => {
            const { error } = await supabaseBrowser().auth.signOut();
            if (error) notify(error.message);
            else window.location.assign('/login');
          }}
        >
          Sign out
        </Button>
      </section>
    </div>
  );
}
