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

interface StoreItemsChartProps {
  items: Array<{
    name: string;
    count: number;
  }>;
}

export default function StoreItemsChart({ items }: StoreItemsChartProps) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Most Purchased Items</h3>
        <div className="text-center py-8 text-gray-500">
          No items data available
        </div>
      </div>
    );
  }

  // Capitalize first letter of each word for display
  const chartData = items.map((item) => ({
    ...item,
    displayName: item.name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Most Purchased Items</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="displayName"
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value} purchases`, 'Count']}
            labelFormatter={(label) => `Item: ${label}`}
          />
          <Bar dataKey="count" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>

      {/* List view as backup */}
      <div className="mt-4 space-y-2">
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className="flex justify-between items-center text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">#{index + 1}</span>
              <span className="text-gray-700">{item.displayName}</span>
            </div>
            <span className="font-semibold text-blue-600">{item.count}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
