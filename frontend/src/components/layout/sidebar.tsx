'use client';
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { initials } from '@/lib/business-context';
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
  PanelLeftClose,
  X,
  Layers,
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
  collapsed,
  toggleCollapsed,
}: {
  active: Module;
  navigate: (module: Module) => void;
  mobileOpen: boolean;
  close: () => void;
  companyName: string;
  alertCount: number;
  collapsed: boolean;
  toggleCollapsed: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const go = (module: Module) => {
    navigate(module);
    close();
  };
  const content = (
    <aside
      id="workspace-navigation"
      aria-label="Workspace navigation"
      className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
    >
      {mobile && (
        <DialogPrimitive.Title className="sr-only">Workspace navigation</DialogPrimitive.Title>
      )}
      <div className="brand">
        <div className="brand-symbol">
          <Layers size={17} strokeWidth={2} />
        </div>
        <span>nexus</span>
        <button className="mobile-close icon-button" onClick={close} aria-label="Close navigation">
          <X size={18} />
        </button>
        <button
          className="sidebar-collapse-icon icon-button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>
      <button
        className="workspace-switch"
        title={`${companyName} · Workspace settings`}
        aria-label={`${companyName} · Workspace settings`}
        onClick={() => go('Settings')}
      >
        <div className="company-avatar">{initials(companyName)}</div>
        <div>
          <strong>{companyName}</strong>
          <span>Operations workspace</span>
        </div>
      </button>
      <nav aria-label="Main navigation">
        {navigation.map(({ label, icon: Icon, section }) => (
          <div key={label}>
            {section && <div className="nav-section">{section}</div>}
            <button
              aria-label={label}
              title={label}
              className={`nav-item ${active === label ? 'nav-active' : ''}`}
              onClick={() => go(label)}
              aria-current={active === label ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Alerts' && alertCount > 0 && (
                <span className="nav-count">{alertCount}</span>
              )}
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          aria-label="Settings"
          title="Settings"
          className={`nav-item ${active === 'Settings' ? 'nav-active' : ''}`}
          onClick={() => go('Settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button
          className="profile"
          aria-label="Profile settings"
          title="Profile settings"
          onClick={() => go('Settings')}
        >
          <div className="user-avatar">N</div>
          <div>
            <strong>Account settings</strong>
            <span>Workspace access</span>
          </div>
        </button>
      </div>
    </aside>
  );
  return mobile ? (
    <DialogPrimitive.Root
      open={mobileOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="mobile-scrim visible" />
        <DialogPrimitive.Content
          asChild
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
          }}
        >
          {content}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  ) : (
    content
  );
}
