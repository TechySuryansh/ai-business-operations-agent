'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  CreditCard,
  FileText,
  Package,
  Play,
  ShieldCheck,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Empty, SectionHeading } from '@/components/ui/shared';
import { useBusiness } from '@/lib/business-context';
import { money } from '@/lib/utils';
import type { Automation, BusinessAlert, Module } from '@/types/business';
export function Alerts({
  alerts,
  reviewed = [],
  snoozed = {},
  restore = () => {},
  snooze = () => {},
  dismiss,
  navigate,
  notify,
}: {
  alerts: BusinessAlert[];
  reviewed?: string[];
  snoozed?: Record<string, number>;
  restore?: (id: string) => void;
  snooze?: (id: string) => void;
  dismiss: (id: string) => void;
  navigate: (m: Module, query?: string) => void;
  notify: (s: string) => void;
}) {
  const { live } = useBusiness();
  const [filter, setFilter] = useState('All alerts');
  const [history, setHistory] = useState(false);
  const [lastReviewed, setLastReviewed] = useState('');
  const active = alerts.filter((a) => !reviewed.includes(a.id) && !(snoozed[a.id] > Date.now()));
  const [ruleOpen, setRuleOpen] = useState(false);
  const visible = alerts.filter(
    (a) =>
      (history
        ? reviewed.includes(a.id) || snoozed[a.id] > Date.now()
        : !reviewed.includes(a.id) && !(snoozed[a.id] > Date.now())) &&
      (filter === 'All alerts' || a.category === filter),
  );
  return (
    <div className="module-stack">
      <div className="alert-summary">
        <div className="alert-summary-icon">
          <Bell size={24} />
        </div>
        <div>
          <h2>{active.length} active exceptions</h2>
          <p>
            {active.length
              ? `${active.length} business signals are ready for your review.`
              : 'All business signals have been reviewed.'}{' '}
            Review each exception or adjust its review status.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRuleOpen(true)}>
          View monitoring rules
        </Button>
      </div>
      <div className="alert-filter-toolbar">
        <div className="filter-tabs standalone" role="group" aria-label="Alert review status">
          <button
            aria-pressed={!history}
            className={!history ? 'active' : ''}
            onClick={() => setHistory(false)}
          >
            Active ({active.length})
          </button>
          <button
            aria-pressed={history}
            className={history ? 'active' : ''}
            onClick={() => setHistory(true)}
          >
            Reviewed & snoozed
          </button>
        </div>
        <label className="category-filter">
          Category
          <select
            aria-label="Alert category"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {['All alerts', 'Inventory', 'Finance', 'Sales'].map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
      </div>
      {lastReviewed && (
        <div className="alert-undo" role="status">
          <span>Alert marked as reviewed.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              restore(lastReviewed);
              setLastReviewed('');
            }}
          >
            Undo review
          </Button>
        </div>
      )}
      <div className="alert-cards">
        {visible.map((a) => (
          <section className="panel alert-card" key={a.id}>
            <span className={`attention-icon attention-${a.severity.toLowerCase()}`}>
              {a.category === 'Inventory' ? (
                <Package size={21} />
              ) : a.category === 'Finance' ? (
                <CreditCard size={21} />
              ) : (
                <Users size={21} />
              )}
            </span>
            <div className="alert-card-body">
              <div className="alert-card-meta">
                <Badge
                  tone={
                    a.severity === 'Critical' ? 'red' : a.severity === 'Warning' ? 'amber' : 'blue'
                  }
                >
                  {a.severity}
                </Badge>
                <span>{a.category}</span>
                <span>·</span>
                <span>
                  {reviewed.includes(a.id)
                    ? 'Reviewed'
                    : snoozed[a.id] > Date.now()
                      ? 'Snoozed for one hour'
                      : 'Nov 14, 2026 snapshot'}
                </span>
              </div>
              <h3>{a.title}</h3>
              <p>{a.description}</p>
              <div className="alert-card-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      a.category === 'Inventory'
                        ? 'Inventory'
                        : a.category === 'Finance'
                          ? 'Finance'
                          : 'Customers',
                      `status=${encodeURIComponent(a.category === 'Inventory' ? 'Low stock' : a.category === 'Finance' ? 'Overdue' : 'Inactive')}`,
                    )
                  }
                >
                  {a.action}
                  <ArrowRight size={14} />
                </Button>
                {!history && (
                  <button className="quiet-action" onClick={() => snooze(a.id)}>
                    <Clock3 size={14} />
                    Snooze 1 hour
                  </button>
                )}
                {history ? (
                  <button className="quiet-action" onClick={() => restore(a.id)}>
                    Restore alert
                  </button>
                ) : (
                  <button
                    className="quiet-action"
                    onClick={() => {
                      dismiss(a.id);
                      setLastReviewed(a.id);
                      notify('Alert marked as reviewed in this browser.');
                    }}
                  >
                    <Check size={14} />
                    Mark reviewed
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="panel">
          <Empty
            title={history ? 'No reviewed or snoozed alerts' : 'Nothing needs attention here'}
            description={
              history
                ? 'Reviewed alerts will appear here and can be restored.'
                : 'You’re up to date on this category.'
            }
          />
        </div>
      )}
      <div className="demo-note">
        <ShieldCheck size={14} />
        {live
          ? `Alerts use company records as of ${live.businessDate}. Refresh the ledger for current balances.`
          : 'Alerts use current local records. Overdue dates are evaluated against the November 14, 2026 snapshot.'}
      </div>
      <Dialog
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        title="Monitoring rules"
        description="The sample alert thresholds for this workspace."
      >
        <div className="rules-list">
          <div>
            <Package size={18} />
            <span>
              <strong>Low inventory</strong>
              <p>Stock is less than the product’s configured reorder level.</p>
            </span>
          </div>
          <div>
            <CreditCard size={18} />
            <span>
              <strong>Overdue invoice</strong>
              <p>
                An unpaid invoice is past its due date as of {live?.businessDate ?? 'Nov 14, 2026'}.
              </p>
            </span>
          </div>
          <div>
            <Users size={18} />
            <span>
              <strong>Inactive customer</strong>
              <p>The customer is marked inactive in the directory.</p>
            </span>
          </div>
        </div>
        <div className="callout">
          Monitoring is simulated. No background jobs or live connections are running.
        </div>
      </Dialog>
    </div>
  );
}
export interface Draft {
  id: string;
  automationId: string;
  title: string;
  body: string;
  status: 'Needs review' | 'Approved in demo' | 'Rejected';
  updated?: string;
  history?: { at: string; action: string }[];
  reason?: string;
  created: string;
}
export function Automations({
  items,
  setItems,
  drafts,
  setDrafts,
  notify,
}: {
  items: Automation[];
  setItems: (items: Automation[]) => void;
  drafts: Draft[];
  setDrafts: (drafts: Draft[]) => void;
  notify: (s: string) => void;
}) {
  const {
    data: { products, invoices, customers },
    companyName,
    formatTime,
  } = useBusiness();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'workflows' | 'drafts'>('workflows');
  const draft = drafts.find((d) => d.id === selected);
  const run = (item: Automation) => {
    let body = '';
    if (item.category === 'Inventory') {
      if (!products.some((p) => p.stock < p.reorder)) {
        notify('No products are below reorder level.');
        return;
      }
      body = `PURCHASE ORDER DRAFT\n\n${products
        .filter((p) => p.stock < p.reorder)
        .map(
          (p) =>
            `${p.name}\nSupplier: ${p.supplier}\nSuggested minimum quantity: ${p.reorder - p.stock} units (to reach reorder level)`,
        )
        .join(
          '\n\n',
        )}\n\nConfirm wholesale pricing, quantities and delivery terms with each supplier before placing an order.`;
    } else if (item.category === 'Finance') {
      const i = invoices
        .filter(
          (i) =>
            i.status === 'Overdue' && (Date.parse('2026-11-14') - Date.parse(i.due)) / 86400000 > 7,
        )
        .sort((a, b) => a.due.localeCompare(b.due))[0];
      if (!i) {
        notify('No invoices meet this workflow’s threshold of more than 7 days overdue.');
        return;
      }
      body = `To: Accounts payable, ${i.customer}\nSubject: A quick reminder about ${i.id}\n\nHello,\n\nI hope you’re well. Our records show an outstanding balance of ${money(i.amount)} for invoice ${i.id}, due on ${i.due}.\n\nCould you let us know when we can expect payment? If payment is already on its way, please disregard this reminder.\n\nThank you,\nTechNova Distributors\n\nThis is a sample draft. No recipient address or email service is connected.`;
    } else {
      const customer = customers.find((c) => c.status === 'Inactive');
      if (!customer) {
        notify('No inactive customers meet this workflow’s criteria.');
        return;
      }
      body = `To: ${customer.contact}, ${customer.name}\nSubject: Let’s catch up\n\nHello ${customer.contact},\n\nWe wanted to check in on your upcoming business needs. Would you like to review our current catalog?\n\nBest,\n${companyName}\n\nLocal demo draft. Nothing will be sent.`;
    }
    body = body.replaceAll('TechNova Distributors', companyName);
    const created: Draft = {
      id: crypto.randomUUID(),
      automationId: item.id,
      title: item.title,
      body,
      status: 'Needs review',
      created: new Date().toISOString(),
      history: [{ at: new Date().toISOString(), action: 'Draft created locally' }],
    };
    setDrafts([created, ...drafts]);
    setItems(
      items.map((i) =>
        i.id === item.id ? { ...i, runs: i.runs + 1, lastRun: 'Just now · demo' } : i,
      ),
    );
    setSelected(created.id);
    setEditing(false);
    setReason('');
    notify('Demo draft created. Review it before approving.');
  };
  return (
    <div className="module-stack">
      <div className="callout purple">
        <ShieldCheck size={19} />
        <div>
          <strong>Drafts require your approval</strong>
          <p>
            Workflows prepare drafts for review. These simulations never send messages, place orders
            or change the local ledger.
          </p>
        </div>
      </div>
      <div className="module-toolbar">
        <div className="filter-tabs">
          <button
            aria-pressed={tab === 'workflows'}
            className={tab === 'workflows' ? 'active' : ''}
            onClick={() => setTab('workflows')}
          >
            Workflows <span>{items.length}</span>
          </button>
          <button
            aria-pressed={tab === 'drafts'}
            className={tab === 'drafts' ? 'active' : ''}
            onClick={() => setTab('drafts')}
          >
            Drafts & approvals <span>{drafts.length}</span>
          </button>
        </div>
        <span className="muted tiny">Manual simulation · no scheduled execution</span>
      </div>
      {tab === 'workflows' ? (
        <div className="automation-grid">
          {items.map((item) => (
            <section key={item.id} className="panel automation-card">
              <div className="automation-card-top">
                <span className="automation-icon">
                  {item.category === 'Inventory' ? (
                    <Package size={22} />
                  ) : item.category === 'Finance' ? (
                    <CreditCard size={22} />
                  ) : (
                    <Users size={22} />
                  )}
                </span>
                <button
                  className={`switch ${item.enabled ? 'switch-on' : ''}`}
                  role="switch"
                  aria-label={`Enable ${item.title}`}
                  aria-checked={item.enabled}
                  onClick={() => {
                    setItems(
                      items.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled } : i)),
                    );
                    notify(
                      `Workflow ${item.enabled ? 'paused' : 'enabled'} for local simulations.`,
                    );
                  }}
                >
                  <span />
                </button>
              </div>
              <span className="eyebrow">{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="automation-rule">
                <Workflow size={14} />
                <span>Trigger → Prepare draft → Human review</span>
              </div>
              <div className="automation-meta">
                <Clock3 size={13} />
                <span>{item.lastRun.replace('Today', 'Nov 14')}</span>
                <span>{item.runs} runs</span>
                <Badge tone={item.enabled ? 'green' : 'neutral'}>
                  {item.enabled ? 'Enabled' : 'Paused'}
                </Badge>
              </div>
              <Button variant="outline" disabled={!item.enabled} onClick={() => run(item)}>
                <Play size={14} />
                Run demo workflow
              </Button>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <SectionHeading
            title="Drafts & approvals"
            description="Your local review history. Approvals are simulated."
          />
          {drafts.length ? (
            drafts.map((d) => (
              <button
                className="draft-row"
                key={d.id}
                onClick={() => {
                  setSelected(d.id);
                  setEditing(false);
                  setReason('');
                }}
              >
                <span className="automation-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <strong>{d.title}</strong>
                  <span>
                    Created{' '}
                    {Number.isNaN(Date.parse(d.created)) ? d.created : formatTime(d.created)}
                  </span>
                </div>
                <Badge
                  tone={
                    d.status === 'Needs review'
                      ? 'amber'
                      : d.status === 'Rejected'
                        ? 'red'
                        : 'green'
                  }
                >
                  {d.status}
                </Badge>
                <ArrowRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              title="Your review queue is clear"
              description="Run a demo workflow to prepare your first draft."
            />
          )}
        </section>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={draft?.title ?? 'Draft'}
        description="Review this simulated business action. No external action will occur."
      >
        {draft && (
          <>
            <Badge
              tone={
                draft.status === 'Needs review'
                  ? 'amber'
                  : draft.status === 'Rejected'
                    ? 'red'
                    : 'green'
              }
            >
              {draft.status}
            </Badge>
            {editing ? (
              <label className="field-label">
                Draft content
                <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
            ) : (
              <pre className="draft-body">{draft.body}</pre>
            )}
            <div className="local-audit">
              <h3>Review history</h3>
              {draft.history?.map((entry, i) => (
                <p key={i}>
                  <time dateTime={entry.at}>{formatTime(entry.at)}</time> · {entry.action}
                </p>
              ))}
              {draft.reason && <p>Rejection reason: {draft.reason}</p>}
            </div>
            {draft.status === 'Needs review' && (
              <label className="field-label">
                Reason for rejection
                <input
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required when rejecting a draft"
                />
              </label>
            )}
            <div className="callout">
              <ShieldCheck size={15} />
              Approval records a local demo decision only.
            </div>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {draft.status === 'Needs review' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(!editing);
                      setBody(draft.body);
                    }}
                  >
                    {editing ? 'Cancel editing' : 'Edit draft'}
                  </Button>
                  {editing && (
                    <Button
                      disabled={!body.trim()}
                      onClick={() => {
                        const at = new Date().toISOString();
                        setDrafts(
                          drafts.map((d) =>
                            d.id === draft.id
                              ? {
                                  ...d,
                                  body: body.trim(),
                                  updated: at,
                                  history: [...(d.history ?? []), { at, action: 'Draft edited' }],
                                }
                              : d,
                          ),
                        );
                        setEditing(false);
                        notify('Draft changes saved locally.');
                      }}
                    >
                      Save draft
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={!reason.trim() || editing}
                    onClick={() => {
                      const at = new Date().toISOString();
                      setDrafts(
                        drafts.map((d) =>
                          d.id === draft.id
                            ? {
                                ...d,
                                status: 'Rejected',
                                reason: reason.trim(),
                                updated: at,
                                history: [...(d.history ?? []), { at, action: 'Draft rejected' }],
                              }
                            : d,
                        ),
                      );
                      notify('Draft rejected locally.');
                    }}
                  >
                    Reject draft
                  </Button>
                </>
              )}
              <Button
                disabled={editing || draft.status !== 'Needs review'}
                onClick={() => {
                  setDrafts(
                    drafts.map((d) =>
                      d.id === draft.id
                        ? {
                            ...d,
                            status: 'Approved in demo',
                            updated: new Date().toISOString(),
                            history: [
                              ...(d.history ?? []),
                              { at: new Date().toISOString(), action: 'Approval recorded locally' },
                            ],
                          }
                        : d,
                    ),
                  );
                  notify('Demo approval saved locally. No external action was taken.');
                }}
              >
                <CheckCheck size={15} />
                {draft.status === 'Needs review' ? 'Approve demo draft' : draft.status}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
