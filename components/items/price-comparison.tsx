'use client';

import { useState } from 'react';
import PurchaseList from '@/components/items/purchase-list';
import { capitalizeWords } from '@/lib/items';
import type { PriceComparisonEntry } from '@/lib/price-comparisons';

interface PriceComparisonProps {
  comparisons: PriceComparisonEntry[];
  // Comparing item types across brands, so show which brands each store had
  byType?: boolean;
}

export default function PriceComparison({
  comparisons,
  byType = false,
}: PriceComparisonProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  // Store rows showing their purchases, keyed by `${itemKey}|${store}`
  const [openStores, setOpenStores] = useState<Set<string>>(new Set());

  const toggleStore = (storeKey: string) => {
    setOpenStores((current) => {
      const next = new Set(current);
      if (next.has(storeKey)) next.delete(storeKey);
      else next.add(storeKey);
      return next;
    });
  };

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
        {byType
          ? 'Compare the same kind of item across stores, whatever the brand. '
          : 'Compare the exact same product across stores. '}
        Prices are per item, and sale prices are shown separately from regular
        prices.
      </p>

      <div className="space-y-3">
        {comparisons.map((comparison) => {
          const itemKey = comparison.key;
          const isExpanded = expandedItem === itemKey;
          const { bestRegular, regularSavings, lowestPaid } = comparison;
          const storesWithRegular = comparison.stores.filter(
            (s) => s.regular_price !== null
          );
          const priciestRegular = storesWithRegular.at(-1);
          const saleOnlyStores = comparison.stores.filter(
            (s) => s.regular_price === null
          );

          return (
            <div
              key={itemKey}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() =>
                  isExpanded
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
                    {bestRegular && regularSavings > 0.5 && (
                      <span className="ml-2 text-green-600 font-medium">
                        Save ${regularSavings.toFixed(2)} by shopping at{' '}
                        {bestRegular.store_name}
                      </span>
                    )}
                    {!bestRegular && lowestPaid.on_sale && (
                      <span className="ml-2 text-amber-700">
                        Lowest price was a sale
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {bestRegular ? (
                      <>
                        <div className="text-sm text-gray-500">
                          Best regular price
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          ${bestRegular.price.toFixed(2)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-gray-500">Lowest paid</div>
                        <div
                          className={`text-lg font-bold ${
                            lowestPaid.on_sale
                              ? 'text-amber-600'
                              : 'text-gray-900'
                          }`}
                        >
                          ${lowestPaid.price.toFixed(2)}
                          {lowestPaid.on_sale && (
                            <span className="ml-1 text-xs font-medium">
                              sale
                            </span>
                          )}
                        </div>
                      </>
                    )}
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
                    {comparison.stores.map((store) => {
                      const isBest = bestRegular?.store_name === store.store_name;
                      const isMostExpensive =
                        storesWithRegular.length > 2 &&
                        priciestRegular?.store_name === store.store_name;
                      const priceVsBest =
                        bestRegular && store.regular_price !== null
                          ? store.regular_price - bestRegular.price
                          : 0;
                      const storeKey = `${itemKey}|${store.store_name}`;
                      const isStoreOpen = openStores.has(storeKey);

                      return (
                        <div
                          key={store.store_name}
                          className={`p-3 rounded-lg ${
                            isBest
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {store.store_name}
                                </span>
                                {isBest && (
                                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-medium">
                                    BEST PRICE
                                  </span>
                                )}
                                {isMostExpensive && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                    Most Expensive
                                  </span>
                                )}
                              </div>
                              {byType && (
                                <div className="text-sm text-gray-700 mt-0.5">
                                  {store.brands.join(', ')}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {store.avg_size && store.avg_unit && (
                                  <span>
                                    Avg size: {store.avg_size} {store.avg_unit} •{' '}
                                  </span>
                                )}
                                Purchased {store.purchase_count} time
                                {store.purchase_count !== 1 ? 's' : ''}
                                {store.sale_count > 0 &&
                                  ` (${store.sale_count} on sale)`}{' '}
                                •{' '}
                                <button
                                  onClick={() => toggleStore(storeKey)}
                                  aria-expanded={isStoreOpen}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  {isStoreOpen ? 'Hide purchases' : 'View purchases'}
                                </button>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              {store.regular_price !== null ? (
                                <div className="text-lg font-semibold">
                                  ${store.regular_price.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  Regular price unknown
                                </div>
                              )}
                              {priceVsBest > 0 && (
                                <div className="text-xs text-red-600">
                                  +${priceVsBest.toFixed(2)}
                                </div>
                              )}
                              {store.sale_price !== null && (
                                <div className="text-xs font-medium text-amber-700">
                                  ${store.sale_price.toFixed(2)} on sale
                                </div>
                              )}
                            </div>
                          </div>
                          {isStoreOpen && (
                            <div className="mt-2 border-t pt-1">
                              <PurchaseList
                                purchases={store.purchases}
                                showStore={false}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Insights */}
                  {bestRegular && priciestRegular && regularSavings > 0.5 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">💡</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Money Saving Tip
                          </p>
                          <p className="text-sm text-blue-800 mt-1">
                            At regular prices, you could save{' '}
                            <strong>${regularSavings.toFixed(2)}</strong> per
                            item by buying this at{' '}
                            <strong>{bestRegular.store_name}</strong> instead of{' '}
                            {priciestRegular.store_name}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {saleOnlyStores.length > 0 && (
                    <p className="mt-3 text-xs text-gray-500">
                      Only bought on sale at{' '}
                      {saleOnlyStores.map((s) => s.store_name).join(', ')}, so
                      the regular price there isn&apos;t known yet.
                    </p>
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
