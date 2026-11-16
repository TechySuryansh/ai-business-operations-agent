'use client';
import { useBusiness } from '@/lib/business-context';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { dailySales } from '@/data/mock-data';
import { money } from '@/lib/utils';
export function RevenueChart({ days = 14 }: { days?: number }) {
  return (
    <div
      className="revenue-chart"
      role="group"
      aria-label="Daily revenue compared with the previous period"
    >
      <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 600, height: 210 }}>
        <AreaChart
          data={dailySales.slice(-days)}
          margin={{ top: 14, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#eceef1" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#596477', fontSize: 12 }}
            minTickGap={35}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#596477', fontSize: 12 }}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={{ border: '1px solid #e9eaf0', borderRadius: 4, fontSize: 12 }}
          />
          <Area
            isAnimationActive={false}
            type="linear"
            dataKey="previous"
            name="Previous period"
            stroke="#a3aab5"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            fill="transparent"
          />
          <Area
            isAnimationActive={false}
            type="linear"
            dataKey="revenue"
            name="This period"
            stroke="#3758d6"
            strokeWidth={2}
            fill="#3758d6"
            fillOpacity={0.04}
            activeDot={{ r: 5, strokeWidth: 3, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <details className="chart-data">
        <summary>View chart data</summary>
        <div className="table-scroll">
          <table>
            <caption>Daily sales · selected snapshot period</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Comparison revenue</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {dailySales.slice(-days).map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{money(row.revenue)}</td>
                  <td>{money(row.previous)}</td>
                  <td>{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function ProductChart() {
  const {
    data: { products },
  } = useBusiness();
  const categoryRevenue = Array.from(new Set(products.map((product) => product.category))).map(
    (category) => ({
      category,
      revenue: products
        .filter((product) => product.category === category)
        .reduce((total, product) => total + product.revenue, 0),
    }),
  );
  return (
    <div className="product-chart" role="group" aria-label="Revenue by product category">
      <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 600, height: 210 }}>
        <BarChart data={categoryRevenue} layout="vertical" margin={{ left: 0, right: 30 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => money(v, true)}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            width={100}
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#f5f5fa' }} />
          <Bar
            isAnimationActive={false}
            dataKey="revenue"
            name="Revenue"
            fill="#526fca"
            radius={[0, 2, 2, 0]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
      <details className="chart-data">
        <summary>View category data</summary>
        <div className="table-scroll">
          <table>
            <caption>Lifetime sample revenue by category</caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {categoryRevenue.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
