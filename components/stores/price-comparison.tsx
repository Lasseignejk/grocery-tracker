'use client';

import { useState } from 'react';

interface PriceComparisonProps {
  comparisons: Array<{
    generic_name: string;
    brand?: string | null;
    variant?: string | null;
    stores: Array<{
      store_name: string;
      avg_price: number;
      avg_size?: string | null;
      avg_unit?: string | null;
      purchase_count: number;
    }>;
  }>;
}

function capitalizeWords(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function PriceComparison({ comparisons }: PriceComparisonProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Price Comparisons</h3>
        <div className="text-center py-8 text-gray-500">
          No comparable items across stores yet. Buy the same items at different
          stores to see price comparisons!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Price Comparisons Across Stores
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Compare prices for items you've purchased at multiple stores
      </p>

      <div className="space-y-3">
        {comparisons.map((comparison) => {
          const itemKey = `${comparison.brand || ''}-${
            comparison.generic_name
          }`;
          const isExpanded = expandedItem === itemKey;
          const sortedStores = [...comparison.stores].sort(
            (a, b) => a.avg_price - b.avg_price
          );
          const cheapest = sortedStores[0];
          const mostExpensive = sortedStores[sortedStores.length - 1];
          const savings = mostExpensive.avg_price - cheapest.avg_price;

          return (
            <div
              key={itemKey}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() =>
                  setIsExpanded
                    ? setExpandedItem(null)
                    : setExpandedItem(itemKey)
                }
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <div className="font-medium">
                    {comparison.brand && (
                      <span className="text-blue-600">
                        {capitalizeWords(comparison.brand)}{' '}
                      </span>
                    )}
                    {capitalizeWords(comparison.generic_name)}
                    {comparison.variant && (
                      <span className="text-gray-600">
                        {' - '}
                        {capitalizeWords(comparison.variant)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Found at {comparison.stores.length} stores
                    {savings > 0.5 && (
                      <span className="ml-2 text-green-600 font-medium">
                        Save ${savings.toFixed(2)} by shopping at{' '}
                        {cheapest.store_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Best Price</div>
                    <div className="text-lg font-bold text-green-600">
                      ${cheapest.avg_price.toFixed(2)}
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'transform rotate-180' : ''
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
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="space-y-2">
                    {sortedStores.map((store, index) => {
                      const isCheapest = index === 0;
                      const isMostExpensive = index === sortedStores.length - 1;
                      const priceVsCheapest =
                        store.avg_price - cheapest.avg_price;

                      return (
                        <div
                          key={store.store_name}
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            isCheapest
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {store.store_name}
                              </span>
                              {isCheapest && (
                                <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-medium">
                                  BEST PRICE
                                </span>
                              )}
                              {isMostExpensive && sortedStores.length > 2 && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  Most Expensive
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {store.avg_size && store.avg_unit && (
                                <span>
                                  Avg size: {store.avg_size} {store.avg_unit} •{' '}
                                </span>
                              )}
                              Purchased {store.purchase_count} time
                              {store.purchase_count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-semibold">
                              ${store.avg_price.toFixed(2)}
                            </div>
                            {priceVsCheapest > 0 && (
                              <div className="text-xs text-red-600">
                                +${priceVsCheapest.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Insights */}
                  {savings > 0.5 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">💡</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Money Saving Tip
                          </p>
                          <p className="text-sm text-blue-800 mt-1">
                            You could save{' '}
                            <strong>${savings.toFixed(2)}</strong> per purchase
                            by buying this at{' '}
                            <strong>{cheapest.store_name}</strong> instead of{' '}
                            {mostExpensive.store_name}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
