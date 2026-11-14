'use client';
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
import { dailySales, products } from '@/data/mock-data';
import { money } from '@/lib/utils';
export function RevenueChart({ days = 14 }: { days?: number }) {
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Daily revenue compared with the previous period"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: 210 }}
      >
        <AreaChart
          data={dailySales.slice(-days)}
          margin={{ top: 14, right: 8, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6260df" stopOpacity={0.17} />
              <stop offset="95%" stopColor="#6260df" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eff0f4" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8b91a1', fontSize: 10 }}
            minTickGap={35}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8b91a1', fontSize: 10 }}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={{ border: '1px solid #e9eaf0', borderRadius: 10, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="previous"
            name="Previous period"
            stroke="#c1c5d8"
            strokeWidth={1.6}
            strokeDasharray="5 5"
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="This period"
            stroke="#6663df"
            strokeWidth={2.5}
            fill="url(#revenue-fill)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ProductChart() {
  const categoryRevenue = Array.from(new Set(products.map((product) => product.category))).map(
    (category) => ({
      category,
      revenue: products
        .filter((product) => product.category === category)
        .reduce((total, product) => total + product.revenue, 0),
    }),
  );
  return (
    <div className="product-chart" role="img" aria-label="Revenue by product category">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: 210 }}
      >
        <BarChart data={categoryRevenue} layout="vertical" margin={{ left: 0, right: 30 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => money(v, true)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            width={100}
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#f5f5fa' }} />
          <Bar dataKey="revenue" name="Revenue" fill="#7673e8" radius={[0, 5, 5, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Sparkline({ variant = 0 }: { variant?: number }) {
  const paths = [
    '0,30 8,25 16,28 24,15 32,19 40,11 48,16 56,5 64,8 72,0',
    '0,30 8,25 16,29 24,20 32,23 40,11 48,14 56,8 64,12 72,2',
    '0,6 8,10 16,5 24,18 32,14 40,22 48,19 56,26 64,21 72,30',
    '0,25 8,25 16,19 24,19 32,22 40,12 48,12 56,8 64,8 72,3',
  ];
  return (
    <svg className="sparkline" width="78" height="38" viewBox="-2 -3 78 40" aria-hidden="true">
      <polyline
        points={paths[variant]}
        fill="none"
        stroke={variant === 2 ? '#db9b48' : '#8e9c91'}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
