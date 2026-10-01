'use client';

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPurchaseDate } from '@/lib/items';

export interface PricePoint {
  // Purchase date as a local timestamp, for the time axis
  t: number;
  date: string;
  price: number;
  on_sale: boolean;
  store_name: string;
}

export interface StoreSeries {
  store_name: string;
  color: string;
  points: PricePoint[]; // oldest first
}

interface ItemPriceChartProps {
  series: StoreSeries[];
  // "/lb" or " each", shown after prices
  per: string;
}

const DAY = 24 * 60 * 60 * 1000;

function formatTick(t: number): string {
  return new Date(t).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function PointTooltip({
  active,
  payload,
  per,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PricePoint }>;
  per: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded border bg-white px-3 py-2 text-sm shadow">
      <div className="font-medium">{point.store_name}</div>
      <div className="text-gray-600">{formatPurchaseDate(point.date)}</div>
      <div>
        ${point.price.toFixed(2)}
        {per}
        {point.on_sale && (
          <span className="ml-2 text-xs font-medium text-amber-700">sale</span>
        )}
      </div>
    </div>
  );
}

// Price paid over time, one line per store. Sale purchases are hollow dots
// off the line, so a one-off sale doesn't read as the usual price.
export default function ItemPriceChart({ series, per }: ItemPriceChartProps) {
  const times = series.flatMap((s) => s.points.map((p) => p.t));
  if (times.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No dated purchases to chart
      </div>
    );
  }

  // Pad the time axis so single purchases don't sit on the edge
  const min = Math.min(...times) - 7 * DAY;
  const max = Math.max(...times) + 7 * DAY;
  const hasSales = series.some((s) => s.points.some((p) => p.on_sale));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="t"
            scale="time"
            domain={[min, max]}
            tickFormatter={formatTick}
          />
          <YAxis
            dataKey="price"
            tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            width={64}
          />
          <Tooltip
            shared={false}
            content={(props) => <PointTooltip {...props} per={per} />}
          />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.store_name}
              data={s.points.filter((p) => !p.on_sale)}
              dataKey="price"
              name={s.store_name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ fill: s.color, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          ))}
          {series.map((s) => (
            <Scatter
              key={`${s.store_name}-sale`}
              data={s.points.filter((p) => p.on_sale)}
              dataKey="price"
              name={`${s.store_name} (sale)`}
              fill="#fff"
              stroke={s.color}
              strokeWidth={2}
              legendType="none"
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      {hasSales && (
        <p className="mt-2 text-xs text-gray-500">
          Hollow dots are sale prices and aren&apos;t part of the trend lines.
        </p>
      )}
    </div>
  );
}
