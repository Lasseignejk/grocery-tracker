'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { truncateLabel } from '@/lib/chart-helpers';

interface SpendingByStoreProps {
  data: Array<{
    store_name: string;
    total: number;
    count: number;
  }>;
}

export default function SpendingByStore({ data }: SpendingByStoreProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Spending by Store</h3>
        <div className="text-center py-8 text-gray-500">
          No data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Spending by Store</h3>
      {/* Horizontal bars so every store name gets its own readable row */}
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(value) => `$${value}`} />
          <YAxis
            type="category"
            dataKey="store_name"
            width={130}
            interval={0}
            tick={{ fontSize: 12 }}
            tickFormatter={(name: string) => truncateLabel(name)}
          />
          <Tooltip
            formatter={(value) => `$${Number(value).toFixed(2)}`}
            labelFormatter={(label) => `Store: ${label}`}
          />
          <Bar dataKey="total" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {data.map((store) => (
          <div
            key={store.store_name}
            className="flex justify-between items-center text-sm"
          >
            <span className="text-gray-600">{store.store_name}</span>
            <div className="flex gap-4">
              <span className="text-gray-500">{store.count} receipts</span>
              <span className="font-semibold">${store.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
