interface SummaryStatsProps {
  stats: {
    totalSpent: number;
    totalReceipts: number;
    totalItems: number;
    avgReceiptAmount: number;
    topStore: string | null;
    topCategory: string | null;
    saleItemsCount: number;
    saleItemsSavings: number;
  };
}

export default function SummaryStats({ stats }: SummaryStatsProps) {
  const statCards = [
    {
      label: 'Total Spent',
      value: `$${stats.totalSpent.toFixed(2)}`,
      icon: '💰',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Receipts',
      value: stats.totalReceipts.toString(),
      icon: '🧾',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Total Items',
      value: stats.totalItems.toString(),
      icon: '🛒',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Avg Receipt',
      value: `$${stats.avgReceiptAmount.toFixed(2)}`,
      icon: '📊',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Top Store',
      value: stats.topStore || 'N/A',
      icon: '🏪',
      color: 'bg-pink-50 text-pink-600',
    },
    {
      label: 'Top Category',
      value: stats.topCategory
        ? stats.topCategory.charAt(0).toUpperCase() +
          stats.topCategory.slice(1).replace('-', ' ')
        : 'N/A',
      icon: '📦',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Sale Items',
      value: stats.saleItemsCount.toString(),
      icon: '🏷️',
      color: 'bg-red-50 text-red-600',
    },
    {
      label: 'Est. Savings',
      value: `$${stats.saleItemsSavings.toFixed(2)}`,
      icon: '💵',
      color: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <div key={stat.label} className={`${stat.color} rounded-lg p-4`}>
          <div className="text-2xl mb-2">{stat.icon}</div>
          <div className="text-sm font-medium opacity-80">{stat.label}</div>
          <div className="text-2xl font-bold mt-1">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
