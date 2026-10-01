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

interface StoreSpendingTrendProps {
  data: Array<{
    date: string;
    total: number;
  }>;
  storeName: string;
}

export default function StoreSpendingTrend({
  data,
  storeName,
}: StoreSpendingTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Spending Trend at {storeName}
        </h3>
        <div className="text-center py-8 text-gray-500">
          No spending data available
        </div>
      </div>
    );
  }

  // Stats below are per visit, but the chart groups visits by month (YYYY-MM)
  const monthlyTotals = data.reduce((acc, item) => {
    const month = item.date.slice(0, 7);
    acc[month] = (acc[month] || 0) + item.total;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({
      month,
      total,
      displayMonth: formatMonthForDisplay(month),
    }));

  // Calculate some stats
  const totalSpent = data.reduce((sum, item) => sum + item.total, 0);
  const avgSpent = totalSpent / data.length;
  const maxSpent = Math.max(...data.map((item) => item.total));
  const minSpent = Math.min(...data.map((item) => item.total));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Spending Trend at {storeName}
      </h3>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Total Visits</div>
          <div className="text-lg font-bold text-blue-600">{data.length}</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Avg per Visit</div>
          <div className="text-lg font-bold text-green-600">
            ${avgSpent.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Highest</div>
          <div className="text-lg font-bold text-amber-600">
            ${maxSpent.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Lowest</div>
          <div className="text-lg font-bold text-purple-600">
            ${minSpent.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Chart */}
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
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Trend insight */}
      {data.length >= 3 &&
        (() => {
          const recent = data.slice(-3);
          const recentAvg =
            recent.reduce((sum, item) => sum + item.total, 0) / recent.length;
          const earlier = data.slice(0, -3);
          const earlierAvg =
            earlier.length > 0
              ? earlier.reduce((sum, item) => sum + item.total, 0) /
                earlier.length
              : recentAvg;

          const percentChange = ((recentAvg - earlierAvg) / earlierAvg) * 100;
          const isIncreasing = percentChange > 5;
          const isDecreasing = percentChange < -5;

          if (isIncreasing || isDecreasing) {
            return (
              <div
                className={`mt-4 p-3 rounded-lg border ${
                  isIncreasing
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{isIncreasing ? '📈' : '📉'}</span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isIncreasing ? 'text-amber-900' : 'text-green-900'
                      }`}
                    >
                      Spending Trend
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        isIncreasing ? 'text-amber-800' : 'text-green-800'
                      }`}
                    >
                      Your recent visits to {storeName} have been{' '}
                      <strong>{isIncreasing ? 'higher' : 'lower'}</strong> than
                      usual ({isIncreasing ? '+' : ''}
                      {percentChange.toFixed(0)}%{' '}
                      {isIncreasing ? 'increase' : 'decrease'}).
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
    </div>
  );
}
