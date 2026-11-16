'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Menu,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Sidebar, navigation } from './layout/sidebar';
import { Overview } from './dashboard/overview';
import { Analytics } from './modules/analytics';
import { Assistant } from './modules/assistant';
import { Records, RecordDetails, type RecordKind, type RecordSelection } from './modules/records';
import { Alerts, Automations, type Draft } from './modules/operations';
import { Reports } from './modules/reports';
import { Settings, type Preferences } from './modules/settings';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Empty, SearchInput } from './ui/shared';
import { alerts as initialAlerts, automations as initialAutomations } from '@/data/mock-data';
import { cn } from '@/lib/utils';
import { BusinessProvider, WorkspaceIdentity, useBusiness } from '@/lib/business-context';
import type { Automation, Module, BusinessAlert } from '@/types/business';
const modules: Module[] = [...navigation.map((n) => n.label), 'Settings'];
const descriptions: Record<Module, string> = {
  Overview: 'A clear view of your business. A confident next move.',
  'AI Assistant': 'Business context. Clear answers. Your next best action.',
  Analytics: 'Turn your numbers into a clearer picture.',
  Customers: 'Build stronger relationships with every account.',
  Sales: 'Every order, from first click to final delivery.',
  Inventory: 'The right products. The right stock levels.',
  Finance: 'Keep cash flow moving in the right direction.',
  Alerts: 'The signals that deserve your attention.',
  Automations: 'Less repetitive work. More room to move.',
  Reports: 'Business insights, ready to take with you.',
  Settings: 'Make this workspace work for you.',
};
const defaults: Preferences = {
  companyName: 'TechNova Distributors',
  emailDigest: false,
  compactTables: false,
  timeZone: 'UTC',
};
interface LocalState {
  preferences: Preferences;
  dismissed: string[];
  workflows: Automation[];
  drafts: Draft[];
  snoozed?: Record<string, number>;
}
function isLocalState(value: unknown): value is LocalState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<LocalState>;
  return (
    !!v.preferences &&
    typeof v.preferences.companyName === 'string' &&
    typeof v.preferences.compactTables === 'boolean' &&
    typeof v.preferences.emailDigest === 'boolean' &&
    v.preferences.companyName.trim().length >= 2 &&
    Array.isArray(v.dismissed) &&
    v.dismissed.every((s) => typeof s === 'string') &&
    Array.isArray(v.workflows) &&
    v.workflows.length === initialAutomations.length &&
    v.workflows.every(
      (a: Automation) =>
        !!a && initialAutomations.some((i) => i.id === a.id) && typeof a.enabled === 'boolean',
    ) &&
    Array.isArray(v.drafts) &&
    v.drafts.every(
      (d: Draft) =>
        !!d &&
        typeof d.id === 'string' &&
        typeof d.body === 'string' &&
        typeof d.title === 'string' &&
        typeof d.created === 'string' &&
        initialAutomations.some((a) => a.id === d.automationId) &&
        ['Needs review', 'Approved in demo', 'Rejected'].includes(d.status) &&
        (!d.history ||
          (Array.isArray(d.history) &&
            d.history.every(
              (e) => e && typeof e.at === 'string' && typeof e.action === 'string',
            ))) &&
        (!d.reason || typeof d.reason === 'string'),
    )
  );
}
export function Workspace() {
  return (
    <BusinessProvider>
      <WorkspaceContent />
    </BusinessProvider>
  );
}
function WorkspaceContent() {
  const business = useBusiness();
  const { customers, products, orders, invoices } = business.data;
  const remembered = useRef<Record<string, string>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(0);
  const [active, setActive] = useState<Module>('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [days, setDays] = useState(14);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState('');
  const toastError = /failed|could not|unavailable|invalid/i.test(toast);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [workflows, setWorkflows] = useState(initialAutomations);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selection, setSelection] = useState<RecordSelection | null>(null);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const navigate = useCallback((module: Module, query?: string) => {
    const current = window.location.hash.slice(1);
    const [currentModule, currentQuery] = current.split('?');
    if (currentModule) {
      const p = new URLSearchParams(currentQuery);
      p.delete('id');
      remembered.current[currentModule] = p.toString();
    }
    const slug = module.toLowerCase().replaceAll(' ', '-');
    const params = query ?? remembered.current[slug] ?? '';
    setActive(module);
    setSelection(null);
    setMobileOpen(false);
    window.location.hash = `${slug}${params ? `?${params}` : ''}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const selectRecord = (record: RecordSelection) => {
    setSelection(record);
    setActive(record.kind);
    const p = new URLSearchParams(window.location.hash.split('?')[1]);
    p.set('id', record.id);
    window.location.hash = `${record.kind.toLowerCase()}?${p}`;
  };
  const closeRecord = () => {
    setSelection(null);
    const [slug, query] = window.location.hash.slice(1).split('?');
    const p = new URLSearchParams(query);
    p.delete('id');
    window.history.replaceState(null, '', `#${slug}${p.size ? `?${p}` : ''}`);
  };
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => {
    const readHash = () => {
      const [slug, query] = window.location.hash.slice(1).split('?');
      const module =
        modules.find((m) => m.toLowerCase().replaceAll(' ', '-') === slug) ?? 'Overview';
      setActive(module);
      setMobileOpen(false);
      const id = new URLSearchParams(query).get('id');
      setSelection(
        id && ['Customers', 'Sales', 'Inventory', 'Finance'].includes(module)
          ? { kind: module as RecordKind, id }
          : null,
      );
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    try {
      const raw = localStorage.getItem('nexus-workspace-v1');
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (isLocalState(saved)) {
          setPreferences({
            ...defaults,
            ...saved.preferences,
            timeZone: ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'].includes(
              saved.preferences.timeZone ?? '',
            )
              ? saved.preferences.timeZone
              : 'UTC',
          });
          if (saved.snoozed && typeof saved.snoozed === 'object')
            setSnoozed(
              Object.fromEntries(
                Object.entries(saved.snoozed).filter(
                  ([, v]) => typeof v === 'number' && Number.isFinite(v),
                ),
              ),
            );
          setSidebarCollapsed(Boolean(saved.preferences.sidebarCollapsed));
          setDismissed(saved.dismissed);
          setWorkflows(
            initialAutomations.map((a) => {
              const savedWorkflow = saved.workflows.find((w) => w.id === a.id)!;
              return {
                ...a,
                enabled: savedWorkflow.enabled,
                runs:
                  Number.isFinite(savedWorkflow.runs) && savedWorkflow.runs >= 0
                    ? savedWorkflow.runs
                    : a.runs,
                lastRun:
                  typeof savedWorkflow.lastRun === 'string' ? savedWorkflow.lastRun : a.lastRun,
              };
            }),
          );
          setDrafts(saved.drafts);
        }
      }
    } catch {}
    setLoaded(true);
    return () => {
      window.removeEventListener('hashchange', readHash);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(
          'nexus-workspace-v1',
          JSON.stringify({
            preferences: { ...preferences, sidebarCollapsed },
            dismissed,
            workflows,
            drafts,
            snoozed,
          }),
        );
      } catch {
        notify('Browser storage is unavailable. Changes will last for this session.');
      }
  }, [preferences, dismissed, workflows, drafts, snoozed, sidebarCollapsed, loaded, notify]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        navigate('AI Assistant');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigate]);
  const low = products.filter((p) => p.stock < p.reorder);
  const overdue = invoices.filter((i) => i.status === 'Overdue');
  const inactive = customers.filter((c) => c.status === 'Inactive');
  const calculatedAlerts: BusinessAlert[] = initialAlerts.flatMap((a) => {
    if (a.category === 'Inventory')
      return low.length
        ? [
            {
              ...a,
              title: `${low.length} products are running low`,
              description: `${low.map((p) => p.name).join(', ')} are below their reorder levels.`,
            },
          ]
        : [];
    if (a.category === 'Finance')
      return overdue.length
        ? [
            {
              ...a,
              title: `$${overdue.reduce((s, i) => s + i.amount, 0).toLocaleString('en-US')} in overdue invoices`,
              description: `${overdue.length} unpaid invoices were due before the Nov 14, 2026 snapshot.`,
            },
          ]
        : [];
    return inactive.length
      ? [
          {
            ...a,
            title: `${inactive.length} customers may need a check-in`,
            description: `${inactive.map((c) => c.name).join(' and ')} are marked inactive in the local directory.`,
          },
        ]
      : [];
  });
  const visibleAlerts = calculatedAlerts.filter(
    (a) => !dismissed.includes(a.id) && !(snoozed[a.id] > (clock || Date.now())),
  );
  const ask = (prompt: string) => {
    setInitialPrompt(prompt);
    navigate('AI Assistant');
  };
  const reset = () => {
    setPreferences(defaults);
    business.reset();
    setSnoozed({});
    setSidebarCollapsed(false);
    remembered.current = {};
    for (const kind of ['Customers', 'Sales', 'Inventory', 'Finance']) {
      try {
        localStorage.removeItem(`nexus-views-${kind}`);
      } catch {}
    }
    setDismissed([]);
    setWorkflows(initialAutomations);
    setDrafts([]);
    try {
      localStorage.removeItem('nexus-chat');
      localStorage.removeItem('nexus-conversations');
      localStorage.removeItem('nexus-report-views');
    } catch {}
    setResetKey((k) => k + 1);
  };
  const results = [
    ...modules.map((m) => ({ label: m, detail: 'Workspace page', module: m, id: '' })),
    ...customers.map((c) => ({
      label: c.name,
      detail: c.email,
      module: 'Customers' as Module,
      id: c.id,
    })),
    ...products.map((p) => ({
      label: p.name,
      detail: p.sku,
      module: 'Inventory' as Module,
      id: p.id,
    })),
    ...orders.map((o) => ({
      label: o.id,
      detail: o.customer,
      module: 'Sales' as Module,
      id: o.id,
    })),
    ...invoices.map((i) => ({
      label: i.id,
      detail: i.customer,
      module: 'Finance' as Module,
      id: i.id,
    })),
  ]
    .filter((r) => `${r.label} ${r.detail}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 12);
  useEffect(() => {
    document.title = `${active} · ${preferences.companyName} | Nexus`;
  }, [active, preferences.companyName]);
  const showRange = active === 'Overview' || active === 'Analytics' || active === 'AI Assistant';
  return (
    <WorkspaceIdentity name={preferences.companyName} timeZone={preferences.timeZone}>
      <div
        className={cn(
          'app-shell',
          preferences.compactTables && 'compact-tables',
          sidebarCollapsed && 'sidebar-is-collapsed',
        )}
      >
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('main-content')?.focus();
          }}
        >
          Skip to main content
        </a>
        <Sidebar
          active={active}
          navigate={navigate}
          mobileOpen={mobileOpen}
          close={() => setMobileOpen(false)}
          companyName={preferences.companyName}
          alertCount={visibleAlerts.length}
          collapsed={sidebarCollapsed}
          toggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                aria-controls="workspace-navigation"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={21} />
              </button>
              <span className="breadcrumb-workspace">Workspace</span>
              <ChevronRight size={13} />
              <strong>{active}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="global-search"
                aria-label="Search anything in workspace"
                onClick={() => {
                  setSearch('');
                  setSearchOpen(true);
                }}
              >
                <Search size={15} />
                <span>Search anything...</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="topbar-divider" />
              <button
                className="icon-button help-button"
                aria-label="About this demo"
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={18} />
              </button>
              <button
                className="icon-button notification-button"
                aria-label={`View ${visibleAlerts.length} alerts`}
                onClick={() => navigate('Alerts')}
              >
                <Bell size={18} />
                {visibleAlerts.length > 0 && <i />}
              </button>
              <button
                className="topbar-avatar"
                aria-label="Open profile settings"
                onClick={() => navigate('Settings')}
              >
                AM
              </button>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            {business.storageError && (
              <div className="callout amber" role="alert">
                {business.storageError}
              </div>
            )}
            <div className="page-heading">
              <div>
                <div className="page-eyebrow">
                  {active === 'Overview'
                    ? 'YOUR BUSINESS. IN FOCUS.'
                    : `${preferences.companyName.toUpperCase()} / ${active.toUpperCase()}`}
                </div>
                <h1>{active === 'Overview' ? 'Business overview' : active}</h1>
                <p>{descriptions[active]}</p>
              </div>
              <div className="page-actions">
                {showRange && (
                  <div className="date-control">
                    <CalendarDays size={14} />
                    <select
                      aria-label="Reporting date range"
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                    >
                      <option value={14}>Nov 1 – Nov 14, 2026</option>
                      <option value={7}>Nov 8 – Nov 14, 2026</option>
                    </select>
                    <ChevronDown size={13} />
                  </div>
                )}
                {active === 'Overview' && (
                  <Button onClick={() => navigate('AI Assistant')}>
                    <Sparkles size={15} />
                    Ask AI
                  </Button>
                )}
                {active === 'Reports' && (
                  <span className="snapshot-pill">
                    <span className="live-dot" />
                    Nov 14, 2026 snapshot
                  </span>
                )}
              </div>
            </div>
            {active === 'Overview' && (
              <Overview
                navigate={navigate}
                ask={ask}
                days={days}
                alerts={visibleAlerts}
                pendingDrafts={drafts.filter((d) => d.status === 'Needs review').length}
                onOrder={(id) => selectRecord({ kind: 'Sales', id })}
              />
            )}
            {active === 'Analytics' && <Analytics days={days} notify={notify} />}
            {active === 'AI Assistant' && (
              <Assistant
                key={resetKey}
                days={days}
                initialPrompt={initialPrompt}
                clearPrompt={() => setInitialPrompt('')}
                navigate={navigate}
                notify={notify}
              />
            )}
            {(['Customers', 'Sales', 'Inventory', 'Finance'] as Module[]).includes(active) && (
              <Records
                key={active}
                kind={active as RecordKind}
                onSelect={selectRecord}
                notify={notify}
              />
            )}
            {active === 'Alerts' && (
              <Alerts
                alerts={calculatedAlerts}
                reviewed={dismissed}
                snoozed={snoozed}
                restore={(id) => {
                  setDismissed((prev) => prev.filter((v) => v !== id));
                  setSnoozed((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                  notify('Alert restored.');
                }}
                snooze={(id) => {
                  setSnoozed((prev) => ({ ...prev, [id]: Date.now() + 60 * 60 * 1000 }));
                  notify('Alert snoozed for one hour.');
                }}
                dismiss={(id) => setDismissed((prev) => Array.from(new Set([...prev, id])))}
                navigate={navigate}
                notify={notify}
              />
            )}
            {active === 'Automations' && (
              <Automations
                items={workflows}
                setItems={setWorkflows}
                drafts={drafts}
                setDrafts={setDrafts}
                notify={notify}
              />
            )}
            {active === 'Reports' && <Reports notify={notify} />}
            {active === 'Settings' && (
              <Settings
                key={resetKey}
                preferences={preferences}
                onSave={setPreferences}
                reset={reset}
                notify={notify}
              />
            )}
            <footer className="workspace-footer">
              <span>
                <span className="live-dot" />
                Demo workspace <i>·</i> Fictional business data
              </span>
              <span>
                Clarity for what comes next.<span className="footer-brand">nexus.</span>
              </span>
            </footer>
          </main>
        </div>
        <Dialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          title="Search your workspace"
          description="Find pages, customers, products, orders and invoices."
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search pages, products, customers…"
            focusOnOpen
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const buttons = document.querySelectorAll<HTMLButtonElement>(
                  '.command-results > button',
                );
                buttons[event.key === 'ArrowDown' ? 0 : buttons.length - 1]?.focus();
              }
            }}
          />
          <div
            className="command-results"
            onKeyDown={(e) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
              const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
              if (!buttons.length) return;
              e.preventDefault();
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? buttons.length - 1
                    : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next].focus();
            }}
          >
            {results.map((r) => (
              <button
                key={`${r.module}-${r.id}`}
                onClick={() => {
                  setSearchOpen(false);
                  navigate(r.module);
                  if (r.id) selectRecord({ kind: r.module as RecordKind, id: r.id });
                }}
              >
                <span className="command-result-icon">
                  {r.id ? <Search size={16} /> : <Command size={16} />}
                </span>
                <div>
                  <strong>{r.label}</strong>
                  <span>{r.detail}</span>
                </div>
                <span>{r.module}</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {results.length === 0 && <Empty />}
          </div>
          <div className="command-footer">
            Tip: use ⌘K or Ctrl+K from anywhere in the workspace.
          </div>
        </Dialog>
        <Dialog
          open={!!selection}
          onOpenChange={(open) => {
            if (!open) closeRecord();
          }}
          title={
            selection
              ? `${selection.kind === 'Finance' ? 'Invoice' : selection.kind === 'Inventory' ? 'Product' : selection.kind === 'Customers' ? 'Customer' : 'Order'} details`
              : 'Record details'
          }
          description={`${preferences.companyName} · Local demo record · Changes stay on this device`}
        >
          {selection && (
            <RecordDetails
              key={`${selection.kind}-${selection.id}`}
              selection={selection}
              navigate={navigate}
              close={closeRecord}
            />
          )}
        </Dialog>
        <Dialog
          open={help}
          onOpenChange={setHelp}
          title="A clearer view of your business"
          description="Nexus is a frontend concept for an AI business operations platform."
        >
          <div className="help-content">
            <div className="assistant-emblem">
              <Sparkles size={25} />
            </div>
            <p>
              Explore your local sales, inventory and finances. Review alerts, download real reports
              of sample records, and simulate workflows with human approval.
            </p>
            <div className="callout">
              This demo has no backend, authentication, AI provider or payment service. Preferences,
              drafts and conversation history stay in your browser.
            </div>
            <Button
              onClick={() => {
                setHelp(false);
                navigate('AI Assistant');
              }}
            >
              Explore the assistant
              <ArrowRight size={15} />
            </Button>
          </div>
        </Dialog>
        {toast && (
          <div
            className={cn('toast', toastError && 'toast-error')}
            role={toastError ? 'alert' : 'status'}
          >
            <span>{toastError ? <X size={15} /> : <Check size={15} />}</span>
            <p>{toast}</p>
            <button aria-label="Dismiss notification" onClick={() => setToast('')}>
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </WorkspaceIdentity>
  );
}
