'use client';

import { useState } from 'react';

interface GroupedItem {
  display_name: string;
  grouping_field: 'brand' | 'generic_name';
  total_spent: number;
  purchase_count: number;
  items: Array<{
    item_name: string;
    total_spent: number;
    purchase_count: number;
  }>;
}

interface TopItemsGroupedProps {
  groupedByBrand: GroupedItem[];
  groupedByGeneric: GroupedItem[];
  ungroupedItems: Array<{
    item_name: string;
    total_spent: number;
    purchase_count: number;
  }>;
}

// Helper function to capitalize first letter of each word
function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function TopItemsGrouped({
  groupedByBrand,
  groupedByGeneric,
  ungroupedItems,
}: TopItemsGroupedProps) {
  const [groupBy, setGroupBy] = useState<'brand' | 'generic' | 'none'>(
    'generic'
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  let displayData: Array<{
    display_name: string;
    total_spent: number;
    purchase_count: number;
    items?: Array<{
      item_name: string;
      total_spent: number;
      purchase_count: number;
    }>;
  }> = [];

  if (groupBy === 'brand') {
    displayData = groupedByBrand;
  } else if (groupBy === 'generic') {
    displayData = groupedByGeneric;
  } else {
    displayData = ungroupedItems;
  }

  if (displayData.length === 0) {
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Most Purchased Items</h3>
        <select
          value={groupBy}
          onChange={(e) => {
            setGroupBy(e.target.value as 'brand' | 'generic' | 'none');
            setExpandedItem(null);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="generic">Group by Generic Name</option>
          <option value="brand">Group by Brand</option>
          <option value="none">Show All Items</option>
        </select>
      </div>

      <div className="space-y-2">
        {displayData.slice(0, 10).map((item, index) => (
          <div key={item.display_name}>
            <div
              className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${
                item.items && item.items.length > 1
                  ? 'cursor-pointer hover:bg-gray-100'
                  : ''
              }`}
              onClick={() => {
                if (item.items && item.items.length > 1) {
                  setExpandedItem(
                    expandedItem === item.display_name
                      ? null
                      : item.display_name
                  );
                }
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">
                    {capitalizeWords(item.display_name)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Purchased {item.purchase_count} time
                    {item.purchase_count !== 1 ? 's' : ''}
                    {item.items && item.items.length > 1 && (
                      <span className="ml-2 text-xs text-blue-600">
                        ({item.items.length} variants)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="font-semibold">
                    ${item.total_spent.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">total spent</p>
                </div>
                {item.items && item.items.length > 1 && (
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedItem === item.display_name
                        ? 'transform rotate-180'
                        : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Expanded breakdown */}
            {expandedItem === item.display_name && item.items && (
              <div className="ml-11 mt-2 space-y-1">
                {item.items.map((subItem) => (
                  <div
                    key={subItem.item_name}
                    className="flex justify-between items-center p-2 bg-blue-50 rounded text-sm"
                  >
                    <div>
                      <p className="text-gray-700">{subItem.item_name}</p>
                      <p className="text-xs text-gray-500">
                        {subItem.purchase_count} time
                        {subItem.purchase_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="font-medium text-gray-700">
                      ${subItem.total_spent.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
