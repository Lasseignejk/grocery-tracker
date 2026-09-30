interface TopItemsProps {
  items: Array<{
    item_name: string;
    total_spent: number;
    purchase_count: number;
  }>;
}

export default function TopItems({ items }: TopItemsProps) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Top Items</h3>
        <div className="text-center py-8 text-gray-500">
          No data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Most Purchased Items</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.item_name}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                {index + 1}
              </div>
              <div>
                <p className="font-medium">{item.item_name}</p>
                <p className="text-sm text-gray-500">
                  Purchased {item.purchase_count} time
                  {item.purchase_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">${item.total_spent.toFixed(2)}</p>
              <p className="text-sm text-gray-500">total spent</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
