'use client';
import { useState } from 'react';
import { Building2, Check, Database, Monitor, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, SectionHeading } from '@/components/ui/shared';
export interface Preferences {
  companyName: string;
  emailDigest: boolean;
  compactTables: boolean;
}
export function Settings({
  preferences,
  onSave,
  reset,
  notify,
}: {
  preferences: Preferences;
  onSave: (p: Preferences) => void;
  reset: () => void;
  notify: (s: string) => void;
}) {
  const [form, setForm] = useState(preferences);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('Workspace');
  return (
    <div className="settings-layout">
      <div className="settings-tabs">
        {['Workspace', 'Preferences', 'Demo data'].map((t, i) => {
          const Icon = [Building2, Monitor, Database][i];
          return (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              <Icon size={16} />
              {t}
            </button>
          );
        })}
      </div>
      <div className="module-stack">
        {tab === 'Workspace' ? (
          <form
            className="panel settings-panel"
            onSubmit={(e) => {
              e.preventDefault();
              onSave({ ...form, companyName: form.companyName.trim() });
              notify('Workspace preferences saved in this browser.');
            }}
          >
            <SectionHeading
              title="Workspace details"
              description="Personalize how your demo workspace appears."
            />
            <div className="workspace-identity">
              <div className="company-avatar">TN</div>
              <div>
                <strong>{form.companyName}</strong>
                <span>
                  Demo workspace <Badge tone="purple">Frontend only</Badge>
                </span>
              </div>
            </div>
            <label className="field-label">
              Workspace name
              <input
                required
                minLength={2}
                maxLength={50}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label className="field-label">
                Industry
                <input readOnly value="Electronics distribution" />
                <small>Defined by this fictional dataset.</small>
              </label>
              <label className="field-label">
                Reporting currency
                <input readOnly value="USD — US Dollar" />
                <small>All sample amounts are denominated in USD.</small>
              </label>
            </div>
            <div className="settings-info">
              <ShieldCheck size={17} />
              <p>
                Alex Morgan · Workspace admin
                <br />
                <span>Sample identity. Authentication and user management are not connected.</span>
              </p>
            </div>
            <div className="settings-footer">
              <span>Stored locally on this device.</span>
              <Button type="submit">
                <Save size={15} />
                Save changes
              </Button>
            </div>
          </form>
        ) : tab === 'Preferences' ? (
          <section className="panel settings-panel">
            <SectionHeading
              title="Display & notification preferences"
              description="Local settings for your workspace experience."
            />
            <div className="preference-row">
              <div>
                <strong>Compact data tables</strong>
                <p>Reduce row spacing in customer, sales and inventory tables.</p>
              </div>
              <button
                role="switch"
                aria-label="Compact data tables"
                aria-checked={preferences.compactTables}
                className={`switch ${preferences.compactTables ? 'switch-on' : ''}`}
                onClick={() => {
                  const next = { ...preferences, compactTables: !preferences.compactTables };
                  setForm(next);
                  onSave(next);
                  notify('Table density updated.');
                }}
              >
                <span />
              </button>
            </div>
            <div className="preference-row">
              <div>
                <strong>Digest preview preference</strong>
                <p>Save a preference for a future daily operations digest. No emails are sent.</p>
              </div>
              <button
                role="switch"
                aria-label="Digest preview preference"
                aria-checked={preferences.emailDigest}
                className={`switch ${preferences.emailDigest ? 'switch-on' : ''}`}
                onClick={() => {
                  const next = { ...preferences, emailDigest: !preferences.emailDigest };
                  setForm(next);
                  onSave(next);
                  notify('Digest preference saved locally.');
                }}
              >
                <span />
              </button>
            </div>
            <div className="preference-row">
              <div>
                <strong>Appearance</strong>
                <p>A clear, focused light theme.</p>
              </div>
              <Badge tone="neutral">Light mode</Badge>
            </div>
          </section>
        ) : (
          <section className="panel settings-panel">
            <SectionHeading
              title="Your demo environment"
              description="A safe place to explore how the product could work."
            />
            <div className="rules-list">
              {[
                'Fictional TechNova business records',
                'Deterministic assistant responses',
                'Local workflow drafts and approvals',
                'No backend, authentication or external services',
              ].map((s) => (
                <div key={s}>
                  <Check size={17} />
                  <strong>{s}</strong>
                </div>
              ))}
            </div>
            <div className="callout">
              Reset restores reviewed alerts, workflow states, conversation history and workspace
              preferences. Source records are never modified.
            </div>
            <Button variant="outline" className="danger-button" onClick={() => setConfirm(true)}>
              Reset local demo
            </Button>
          </section>
        )}
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset this demo?"
        description="Your local conversation, drafts, reviewed alerts and preferences will be cleared. The original fictional records will remain."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Keep my changes
          </Button>
          <Button
            onClick={() => {
              reset();
              setConfirm(false);
              setForm({
                companyName: 'TechNova Distributors',
                emailDigest: false,
                compactTables: false,
              });
              notify('The local demo has been reset.');
            }}
          >
            Reset demo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
