'use client';
import {
  LayoutDashboard,
  Sparkles,
  ChartNoAxesCombined,
  Users,
  ShoppingBag,
  Package,
  Wallet,
  Bell,
  Workflow,
  FileText,
  Settings,
  ChevronDown,
  ArrowUpRight,
  PanelLeftClose,
  X,
  Command,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Module } from '@/types/business';
export const navigation: { label: Module; icon: LucideIcon; section?: string }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'AI Assistant', icon: Sparkles },
  { label: 'Analytics', icon: ChartNoAxesCombined },
  { label: 'Customers', icon: Users, section: 'WORKSPACE' },
  { label: 'Sales', icon: ShoppingBag },
  { label: 'Inventory', icon: Package },
  { label: 'Finance', icon: Wallet },
  { label: 'Alerts', icon: Bell, section: 'OPERATIONS' },
  { label: 'Automations', icon: Workflow },
  { label: 'Reports', icon: FileText },
];
export function Sidebar({
  active,
  navigate,
  mobileOpen,
  close,
  companyName,
  alertCount,
}: {
  active: Module;
  navigate: (module: Module) => void;
  mobileOpen: boolean;
  close: () => void;
  companyName: string;
  alertCount: number;
}) {
  const go = (module: Module) => {
    navigate(module);
    close();
  };
  return (
    <>
      <button
        className={`mobile-scrim ${mobileOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={close}
      />
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-symbol">
            <Command size={21} strokeWidth={2.4} />
          </div>
          <span>
            nexus<span className="brand-dot">.</span>
          </span>
          <button
            className="mobile-close icon-button"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          <PanelLeftClose className="sidebar-collapse-icon" size={17} />
        </div>
        <button className="workspace-switch" onClick={() => go('Settings')}>
          <div className="company-avatar">TN</div>
          <div>
            <strong>{companyName}</strong>
            <span>Business workspace</span>
          </div>
          <ChevronDown size={14} />
        </button>
        <nav aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, section }) => (
            <div key={label}>
              {section && <div className="nav-section">{section}</div>}
              <button
                className={`nav-item ${active === label ? 'nav-active' : ''}`}
                onClick={() => go(label)}
                aria-current={active === label ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {label === 'AI Assistant' && <span className="new-label">NEW</span>}
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="nav-count">{alertCount}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Sparkles size={16} />
            </div>
            <strong>A little less busywork.</strong>
            <p>
              Let your business assistant
              <br />
              handle the heavy lifting.
            </p>
            <button onClick={() => go('AI Assistant')}>
              Meet your assistant <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${active === 'Settings' ? 'nav-active' : ''}`}
            onClick={() => go('Settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="profile" onClick={() => go('Settings')}>
            <div className="user-avatar">AM</div>
            <div>
              <strong>Alex Morgan</strong>
              <span>Workspace admin</span>
            </div>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
