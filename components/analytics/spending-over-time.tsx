'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatMonthForDisplay } from '@/lib/chart-helpers';

interface SpendingOverTimeProps {
  data: Array<{
    month: string; // YYYY-MM
    total: number;
  }>;
}

export default function SpendingOverTime({ data }: SpendingOverTimeProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Spending Over Time</h3>
        <div className="text-center py-8 text-gray-500">
          No data available yet
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    displayMonth: formatMonthForDisplay(item.month),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Spending Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayMonth" />
          <YAxis />
          <Tooltip
            formatter={(value) => `$${Number(value).toFixed(2)}`}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
