'use client';
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
import { RevenueChart, Sparkline } from './charts';
import { SectionHeading, TextLink, StatusBadge } from '@/components/ui/shared';
import { Button } from '@/components/ui/button';
import { activities, orders, products } from '@/data/mock-data';
import { getMetrics } from '@/lib/demo-analytics';
import { money, number } from '@/lib/utils';
import type { BusinessAlert, Module } from '@/types/business';
export function Overview({
  navigate,
  ask,
  days,
  alerts,
  onOrder,
}: {
  navigate: (module: Module) => void;
  ask: (prompt: string) => void;
  days: number;
  alerts: BusinessAlert[];
  onOrder: (id: string) => void;
}) {
  const metrics = getMetrics(days);
  const stats = [
    {
      label: 'Total revenue',
      value: money(metrics.revenue),
      change: `${metrics.growth}%`,
      detail: 'vs. previous period',
      icon: CircleDollarSign,
    },
    {
      label: 'Total orders',
      value: number(metrics.orders),
      change: `${days} days`,
      detail: 'reporting period',
      icon: ShoppingBag,
    },
    {
      label: 'Outstanding payments',
      value: money(metrics.outstanding),
      change: '3 overdue',
      detail: 'invoices need attention',
      icon: CreditCard,
    },
    {
      label: 'Active customers',
      value: number(metrics.activeCustomers),
      change: '2 inactive',
      detail: 'ready for a follow-up',
      icon: Users,
    },
  ];
  const top = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  return (
    <div className="overview-grid">
      <div className="insight-banner">
        <div className="insight-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <div className="eyebrow">
            YOUR BUSINESS, AT A GLANCE <span className="live-dot" />{' '}
            <span className="ai-caption">AI brief</span>
          </div>
          <p>
            Revenue is up <strong>{metrics.growth}%</strong>. A strong period, with a few things to
            keep an eye on.
          </p>
          <span>
            {metrics.lowStock} products need restocking and 3 invoices are overdue. Let’s stay ahead
            of them.
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
              <Sparkline variant={i} />
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
          description="A closer look at how your business is growing."
          action={
            <select
              className="subtle-select"
              aria-label="Revenue chart metric"
              onChange={(e) => e.target.value === 'orders' && navigate('Analytics')}
              defaultValue="revenue"
            >
              <option value="revenue">Revenue</option>
              <option value="orders">Orders analytics</option>
            </select>
          }
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
          action={<TextLink onClick={() => navigate('Inventory')}>View all</TextLink>}
        />
        <div className="top-products">
          {top.map((p, i) => (
            <button key={p.id} className="top-product" onClick={() => navigate('Inventory')}>
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
          action={<span className="muted tiny">Today, Nov 14</span>}
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
                <span>{a.time}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="assistant-promo">
        <div className="promo-orbit">
          <Sparkles size={25} />
          <span />
          <span />
        </div>
        <span className="eyebrow">YOUR NEXT MOVE, MADE SIMPLE</span>
        <h2>
          Good questions.
          <br />
          Better business decisions.
        </h2>
        <p>
          Ask about your numbers, find opportunities,
          <br />
          and turn insights into your next action.
        </p>
        <Button onClick={() => navigate('AI Assistant')}>
          Ask your assistant <ArrowUpRight size={15} />
        </Button>
        <span className="promo-note">Built around your business.</span>
      </section>
    </div>
  );
}
