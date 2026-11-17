'use client';
import { useBusiness, exportName } from '@/lib/business-context';
import { ArrowUpRight, CircleDollarSign, Download, ShoppingBag, TrendingUp } from 'lucide-react';
import { ProductChart, RevenueChart } from '@/components/dashboard/charts';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/shared';
import { dailySales } from '@/data/mock-data';
import { getMetrics } from '@/lib/demo-analytics';
import { downloadCSV, money, number } from '@/lib/utils';
export function Analytics({ days, notify }: { days: number; notify: (s: string) => void }) {
  const { data, companyName, live } = useBusiness();
  const { customers } = data;
  const m = getMetrics(days, data);
  return (
    <div className="module-stack">
      <div className="summary-grid">
        <div className="panel summary-card">
          <span>
            Revenue
            <CircleDollarSign size={16} />
          </span>
          <strong>{money(m.revenue)}</strong>
          <small className="change-green">
            <TrendingUp size={12} />
            {m.growth}% vs. comparison period
          </small>
        </div>
        <div className="panel summary-card">
          <span>
            Orders
            <ShoppingBag size={16} />
          </span>
          <strong>{number(m.orders)}</strong>
          <small>
            Last {days} days {live ? 'of company orders' : 'of sample data'}
          </small>
        </div>
        <div className="panel summary-card">
          <span>
            Average order value
            <ArrowUpRight size={16} />
          </span>
          <strong>{money(m.orders ? m.revenue / m.orders : 0)}</strong>
          <small>Revenue divided by total orders</small>
        </div>
      </div>
      <section className="panel">
        <SectionHeading
          title="Revenue performance"
          description={
            live
              ? `Last ${days} days · Booked order value · ${live.company.timeZone}`
              : `November ${15 - days}–14, 2026 · Daily sales aggregates`
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCSV(
                  `${exportName(companyName)}-daily-sales`,
                  (data.dailySales ?? dailySales).slice(-days),
                );
                notify('Daily sales exported as CSV.');
              }}
            >
              <Download size={14} />
              Export data
            </Button>
          }
        />
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
      <div className="analytics-grid">
        <section className="panel">
          <SectionHeading
            title="Product performance"
            description={
              live ? 'Booked order value by product.' : 'Revenue across the sample product catalog.'
            }
          />
          <ProductChart />
        </section>
        <section className="panel">
          <SectionHeading
            title="Customer revenue"
            description={
              live
                ? 'Top accounts by booked order value.'
                : 'Top accounts by lifetime sample revenue.'
            }
          />
          <div className="customer-bars">
            {[...customers]
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5)
              .map((c, i) => (
                <div key={c.id}>
                  <div>
                    <span>
                      <i>0{i + 1}</i>
                      {c.name}
                    </span>
                    <strong>{money(c.revenue)}</strong>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${(c.revenue / Math.max(1, ...customers.map((account) => account.revenue))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
      <div className="callout">
        {live
          ? 'Revenue means booked order value, excluding cancelled orders. Product and customer totals cover all booked orders; the chart covers the selected period. Cash collected is tracked separately through payments.'
          : 'Daily revenue aggregates cover the selected period. Product and customer figures are separate lifetime sample datasets, rather than a reconciliation of the recent order list.'}
      </div>
    </div>
  );
}
