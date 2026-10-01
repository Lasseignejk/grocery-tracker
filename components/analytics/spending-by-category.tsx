'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CATEGORY_COLORS } from '@/lib/chart-helpers';

interface SpendingByCategoryProps {
  data: Array<{
    category: string;
    total: number;
  }>;
}

export default function SpendingByCategory({ data }: SpendingByCategoryProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
        <div className="text-center py-8 text-gray-500">
          No data available yet
        </div>
      </div>
    );
  }

  const grandTotal = data.reduce((sum, item) => sum + item.total, 0);

  const chartData = data.map((item) => ({
    ...item,
    name:
      item.category.charAt(0).toUpperCase() +
      item.category.slice(1).replace('-', ' '),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={110}
            fill="#8884d8"
            dataKey="total"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const amount = Number(value);
              const percent = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
              return `$${amount.toFixed(2)} (${percent.toFixed(0)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.map((cat, index) => (
          <div key={cat.category} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor:
                  CATEGORY_COLORS[index % CATEGORY_COLORS.length],
              }}
            />
            <span className="text-gray-600 flex-1">{cat.name}</span>
            <span className="font-semibold">${cat.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
