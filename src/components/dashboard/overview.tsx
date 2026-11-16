'use client';
import { useBusiness } from '@/lib/business-context';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CircleDollarSign,
  CreditCard,
  FileText,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { RevenueChart } from './charts';
import { SectionHeading, TextLink, StatusBadge } from '@/components/ui/shared';
import { Button } from '@/components/ui/button';
import { activities } from '@/data/mock-data';
import { getMetrics } from '@/lib/demo-analytics';
import { money, number } from '@/lib/utils';
import type { BusinessAlert, Module } from '@/types/business';
export function Overview({
  navigate,
  ask,
  days,
  alerts,
  onOrder,
  pendingDrafts,
}: {
  navigate: (module: Module, query?: string) => void;
  ask: (prompt: string) => void;
  days: number;
  alerts: BusinessAlert[];
  onOrder: (id: string) => void;
  pendingDrafts: number;
}) {
  const { data, audit, formatTime } = useBusiness();
  const { orders, products } = data;
  const metrics = getMetrics(days, data);
  const stats = [
    {
      label: 'Period revenue',
      value: money(metrics.revenue),
      change: `${metrics.growth}%`,
      detail: 'vs. previous period',
      icon: CircleDollarSign,
    },
    {
      label: 'Period orders',
      value: number(metrics.orders),
      change: `${days} days`,
      detail: 'historical daily aggregates',
      icon: ShoppingBag,
    },
    {
      label: 'Outstanding payments',
      value: money(metrics.outstanding),
      change: `${metrics.overdue} overdue`,
      detail: 'invoices need attention',
      icon: CreditCard,
    },
    {
      label: 'Active customers',
      value: number(metrics.activeCustomers),
      change: `${metrics.inactiveCustomers} inactive`,
      detail: 'ready for a follow-up',
      icon: Users,
    },
  ];
  const top = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  return (
    <div className="overview-grid">
      <p className="data-scope">
        Revenue and order trends: Nov {15 - days}–14, 2026. Balances, customers and stock: current
        local records. Product rankings: lifetime sample totals.
      </p>
      <div className="insight-banner">
        <div className="insight-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <div className="eyebrow">
            YOUR BUSINESS, AT A GLANCE <span className="live-dot" />{' '}
            <span className="ai-caption">Calculated summary · demo snapshot</span>
          </div>
          <p>
            Revenue is up <strong>{metrics.growth}%</strong>. A strong period, with a few things to
            keep an eye on.
          </p>
          <span>
            {metrics.lowStock} products need restocking and {metrics.overdue} invoices are overdue.
            Let’s stay ahead of them.
          </span>
        </div>
        <button onClick={() => ask('How is my business doing?')}>
          Explore insights <ArrowRight size={16} />
        </button>
      </div>
      <div className="metrics-grid">
        {stats.map((stat, i) => (
          <button
            className="metric-card"
            key={stat.label}
            onClick={() =>
              navigate((['Analytics', 'Sales', 'Finance', 'Customers'] as Module[])[i])
            }
          >
            <div className="metric-label">
              {stat.label}
              <stat.icon size={16} />
            </div>
            <div className="metric-main">
              <strong>{stat.value}</strong>
            </div>
            <div className="metric-foot">
              <span
                className={i === 2 ? 'change-amber' : i === 0 ? 'change-green' : 'change-neutral'}
              >
                {i === 0 ? <TrendingUp size={12} /> : null}
                {stat.change}
              </span>
              <span>{stat.detail}</span>
            </div>
          </button>
        ))}
      </div>
      <section className="panel revenue-panel">
        <SectionHeading
          title="Revenue overview"
          description={`Nov ${15 - days}–14, 2026 · Historical daily sales aggregates`}
        />
        <div className="chart-summary">
          <strong>{money(metrics.revenue)}</strong>
          <span className="change-green">
            <TrendingUp size={12} />
            {metrics.growth}%
          </span>
          <span>vs. previous period</span>
        </div>
        <RevenueChart days={days} />
        <div className="chart-legend">
          <span>
            <i className="legend-current" />
            This period
          </span>
          <span>
            <i className="legend-previous" />
            Previous period
          </span>
        </div>
      </section>
      <section className="panel attention-panel">
        <SectionHeading
          title="Needs your attention"
          action={<span className="count-pill">{alerts.length}</span>}
        />
        <p className="panel-subtitle">Small actions. A healthier business.</p>
        <div className="attention-list">
          {alerts.length === 0 ? (
            <div className="all-clear">
              <Zap size={24} />
              <strong>You’re all caught up</strong>
              <p>No active alerts to review.</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <button className="attention-item" key={alert.id} onClick={() => navigate('Alerts')}>
                <span className={`attention-icon attention-${alert.severity.toLowerCase()}`}>
                  {i === 0 ? (
                    <Package size={16} />
                  ) : i === 1 ? (
                    <CreditCard size={16} />
                  ) : (
                    <Users size={16} />
                  )}
                </span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>
                    {alert.category === 'Inventory'
                      ? 'Below their reorder threshold'
                      : alert.category === 'Finance'
                        ? 'Follow up to keep cash flowing'
                        : 'A good time to reconnect'}
                  </p>
                  <span>
                    {alert.action}
                    <ArrowRight size={12} />
                  </span>
                </div>
                <span className="attention-dot" />
              </button>
            ))
          )}
        </div>
        <button className="panel-bottom-link" onClick={() => navigate('Alerts')}>
          View all alerts <ArrowRight size={14} />
        </button>
      </section>
      <section className="panel orders-panel">
        <SectionHeading
          title="Recent orders"
          action={<TextLink onClick={() => navigate('Sales')}>View all orders</TextLink>}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="align-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 4).map((order) => (
                <tr key={order.id}>
                  <td>
                    <button className="record-link" onClick={() => onOrder(order.id)}>
                      {order.id}
                    </button>
                  </td>
                  <td>
                    <div className="table-customer">
                      <span className="small-avatar">
                        {order.customer
                          .split(' ')
                          .map((s) => s[0])
                          .join('')}
                      </span>
                      {order.customer}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="align-right amount">{money(order.amount)}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${order.id}`}
                      onClick={() => onOrder(order.id)}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel products-panel">
        <SectionHeading
          title="Top products"
          action={<TextLink onClick={() => navigate('Inventory', '')}>View all</TextLink>}
        />
        <div className="top-products">
          {top.map((p, i) => (
            <button
              key={p.id}
              className="top-product"
              onClick={() => navigate('Inventory', `id=${encodeURIComponent(p.id)}`)}
            >
              <span className="product-rank">0{i + 1}</span>
              <div>
                <strong>{p.name}</strong>
                <span>{p.sold} units sold</span>
              </div>
              <b>{money(p.revenue)}</b>
            </button>
          ))}
        </div>
      </section>
      <section className="panel activity-panel">
        <SectionHeading
          title="Recent activity"
          action={<span className="muted tiny">Snapshot · Nov 14, 2026</span>}
        />
        <div className="activity-list">
          {activities.map((a) => (
            <button
              key={a.id}
              className="activity-item"
              onClick={() =>
                navigate(
                  a.kind === 'order'
                    ? 'Sales'
                    : a.kind === 'payment'
                      ? 'Finance'
                      : a.kind === 'inventory'
                        ? 'Inventory'
                        : 'Reports',
                  a.kind === 'order'
                    ? 'id=ORD-2048'
                    : a.kind === 'payment'
                      ? 'id=INV-1088'
                      : a.kind === 'inventory'
                        ? 'status=Low+stock'
                        : undefined,
                )
              }
            >
              <span className={`activity-icon activity-${a.kind}`}>
                {a.kind === 'order' ? (
                  <ShoppingBag size={15} />
                ) : a.kind === 'payment' ? (
                  <ArrowDown size={15} />
                ) : a.kind === 'inventory' ? (
                  <Package size={15} />
                ) : (
                  <FileText size={15} />
                )}
              </span>
              <div>
                <strong>{a.title}</strong>
                <p>{a.detail}</p>
              </div>
              <div className="activity-value">
                <strong>{a.value}</strong>
                <span>Snapshot activity</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="panel work-queue">
        <SectionHeading
          title="Your work queue"
          description="Current local records · historical charts stay unchanged"
        />
        <div className="task-list">
          <button onClick={() => navigate('Finance', 'status=Overdue')}>
            <CreditCard size={18} />
            <span>
              <strong>{metrics.overdue} overdue invoices</strong>
              <small>Review balances and record payments</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('Inventory', 'status=Low+stock')}>
            <Package size={18} />
            <span>
              <strong>{metrics.lowStock} products below reorder level</strong>
              <small>Adjust stock or prepare purchase drafts</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('Automations')}>
            <Zap size={18} />
            <span>
              <strong>{pendingDrafts} drafts awaiting review</strong>
              <small>Review prepared business actions</small>
            </span>
            <ArrowRight size={16} />
          </button>
        </div>
        {audit.length > 0 && (
          <div className="local-audit">
            <h3>Latest local change</h3>
            <p>{audit[0].message}</p>
            <time dateTime={audit[0].at}>{formatTime(audit[0].at)}</time>
          </div>
        )}
      </section>
    </div>
  );
}
