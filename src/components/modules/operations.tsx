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
import { invoices, products } from '@/data/mock-data';
import { money } from '@/lib/utils';
import type { Automation, BusinessAlert, Module } from '@/types/business';
export function Alerts({
  alerts,
  dismiss,
  navigate,
  notify,
}: {
  alerts: BusinessAlert[];
  dismiss: (id: string) => void;
  navigate: (m: Module) => void;
  notify: (s: string) => void;
}) {
  const [filter, setFilter] = useState('All alerts');
  const [ruleOpen, setRuleOpen] = useState(false);
  const visible = alerts.filter((a) => filter === 'All alerts' || a.category === filter);
  return (
    <div className="module-stack">
      <div className="alert-summary">
        <div className="alert-summary-icon">
          <Bell size={24} />
        </div>
        <div>
          <h2>Stay one step ahead.</h2>
          <p>
            {alerts.length
              ? `${alerts.length} business signals are ready for your review.`
              : 'All business signals have been reviewed.'}{' '}
            Your rules keep the important things in view.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRuleOpen(true)}>
          View monitoring rules
        </Button>
      </div>
      <div className="filter-tabs standalone">
        {['All alerts', 'Inventory', 'Finance', 'Sales'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
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
                <span>{a.time}</span>
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
                    )
                  }
                >
                  {a.action}
                  <ArrowRight size={14} />
                </Button>
                <button
                  className="quiet-action"
                  onClick={() => {
                    dismiss(a.id);
                    notify('Alert marked as reviewed in this browser.');
                  }}
                >
                  <Check size={14} />
                  Mark reviewed
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="panel">
          <Empty
            title="Nothing needs attention here"
            description="You’re up to date on this category."
          />
        </div>
      )}
      <div className="demo-note">
        <ShieldCheck size={14} />
        Alerts are predefined sample signals, evaluated as of November 14, 2026.
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
              <p>An unpaid invoice is past its due date as of Nov 14, 2026.</p>
            </span>
          </div>
          <div>
            <Users size={18} />
            <span>
              <strong>Inactive customer</strong>
              <p>No order in the last 60 days.</p>
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
  status: 'Needs review' | 'Approved in demo';
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
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'workflows' | 'drafts'>('workflows');
  const draft = drafts.find((d) => d.id === selected);
  const run = (item: Automation) => {
    let body = '';
    if (item.category === 'Inventory') {
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
      const i = invoices.find((i) => i.status === 'Overdue')!;
      body = `To: Accounts payable, ${i.customer}\nSubject: A quick reminder about ${i.id}\n\nHello,\n\nI hope you’re well. Our records show an outstanding balance of ${money(i.amount)} for invoice ${i.id}, due on ${i.due}.\n\nCould you let us know when we can expect payment? If payment is already on its way, please disregard this reminder.\n\nThank you,\nTechNova Distributors\n\nThis is a sample draft. No recipient address or email service is connected.`;
    } else
      body =
        'To: Metro Digital\nSubject: Let’s catch up\n\nHi Olivia,\n\nIt’s been a little while since your last order, and we wanted to check in. We’d be happy to help with your upcoming electronics needs.\n\nWould you like to review our current range of monitors and accessories?\n\nBest,\nThe TechNova team\n\nThis is a sample draft. Nothing will be sent.';
    const created: Draft = {
      id: crypto.randomUUID(),
      automationId: item.id,
      title: item.title,
      body,
      status: 'Needs review',
      created: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setDrafts([created, ...drafts]);
    setItems(
      items.map((i) =>
        i.id === item.id ? { ...i, runs: i.runs + 1, lastRun: 'Just now · demo' } : i,
      ),
    );
    setSelected(created.id);
    notify('Demo draft created. Review it before approving.');
  };
  return (
    <div className="module-stack">
      <div className="callout purple">
        <ShieldCheck size={19} />
        <div>
          <strong>You stay in control.</strong>
          <p>
            Workflows prepare drafts for review. This frontend never sends messages, places orders
            or changes business records.
          </p>
        </div>
      </div>
      <div className="module-toolbar">
        <div className="filter-tabs">
          <button
            className={tab === 'workflows' ? 'active' : ''}
            onClick={() => setTab('workflows')}
          >
            Workflows <span>{items.length}</span>
          </button>
          <button className={tab === 'drafts' ? 'active' : ''} onClick={() => setTab('drafts')}>
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
                <span>{item.lastRun}</span>
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
              <button className="draft-row" key={d.id} onClick={() => setSelected(d.id)}>
                <span className="automation-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <strong>{d.title}</strong>
                  <span>Created at {d.created}</span>
                </div>
                <Badge tone={d.status === 'Needs review' ? 'amber' : 'green'}>{d.status}</Badge>
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
            <Badge tone={draft.status === 'Needs review' ? 'amber' : 'green'}>{draft.status}</Badge>
            <pre className="draft-body">{draft.body}</pre>
            <div className="callout">
              <ShieldCheck size={15} />
              Approval records a local demo decision only.
            </div>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button
                disabled={draft.status !== 'Needs review'}
                onClick={() => {
                  setDrafts(
                    drafts.map((d) =>
                      d.id === draft.id ? { ...d, status: 'Approved in demo' } : d,
                    ),
                  );
                  notify('Demo approval saved locally. No external action was taken.');
                }}
              >
                <CheckCheck size={15} />
                {draft.status === 'Needs review' ? 'Approve demo draft' : 'Approved in demo'}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
