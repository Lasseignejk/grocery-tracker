'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CATEGORY_COLORS } from '@/lib/chart-helpers';

interface StoreCategoryBreakdownProps {
  data: Array<{
    category: string;
    total: number;
  }>;
}

export default function StoreCategoryBreakdown({
  data,
}: StoreCategoryBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
        <div className="text-center py-8 text-gray-500">
          No category data available
        </div>
      </div>
    );
  }

  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    name:
      item.category.charAt(0).toUpperCase() +
      item.category.slice(1).replace('-', ' '),
  }));

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.total, 0);

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
              const percent = total > 0 ? (amount / total) * 100 : 0;
              return `$${amount.toFixed(2)} (${percent.toFixed(0)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Category breakdown list */}
      <div className="mt-4 grid grid-cols-1 gap-2">
        {chartData.map((cat, index) => {
          const percentage = (cat.total / total) * 100;

          return (
            <div
              key={cat.category}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                  }}
                />
                <span className="text-sm text-gray-700">{cat.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-12 text-right">
                  {percentage.toFixed(1)}%
                </span>
                <span className="font-semibold text-sm w-20 text-right">
                  ${cat.total.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t flex justify-between items-center">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="font-bold text-lg text-blue-600">
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
