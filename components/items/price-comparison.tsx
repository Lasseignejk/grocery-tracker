'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import PurchaseList from '@/components/items/purchase-list';
import { capitalizeWords, itemHref } from '@/lib/items';
import type { PriceComparisonEntry } from '@/lib/price-comparisons';

interface PriceComparisonProps {
  comparisons: PriceComparisonEntry[];
  // Comparing item types across brands, so show which brands each store had
  byType?: boolean;
}

type SortKey = 'savings' | 'most-bought' | 'name';

const MODES = [
  { byType: false, label: 'Exact product', href: '/items/price-comparison' },
  { byType: true, label: 'Item type', href: '/items/price-comparison?by=type' },
];

function titleOf(comparison: PriceComparisonEntry): string {
  return [comparison.brand, comparison.generic_name, comparison.variant]
    .filter(Boolean)
    .map(capitalizeWords)
    .join(' ');
}

function purchaseCount(comparison: PriceComparisonEntry): number {
  return comparison.stores.reduce((n, s) => n + s.purchase_count, 0);
}

export default function PriceComparison({
  comparisons,
  byType = false,
}: PriceComparisonProps) {
  const [query, setQuery] = useState('');
  const [store, setStore] = useState('');
  const [sort, setSort] = useState<SortKey>('savings');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  // Store rows showing their purchases, keyed by `${itemKey}|${store}`
  const [openStores, setOpenStores] = useState<Set<string>>(new Set());

  // Stores by how many compared items were bought there
  const storeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comparison of comparisons) {
      for (const s of comparison.stores) {
        counts.set(s.store_name, (counts.get(s.store_name) ?? 0) + 1);
      }
    }
    return Array.from(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }, [comparisons]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = comparisons.filter(
      (comparison) =>
        (!store || comparison.stores.some((s) => s.store_name === store)) &&
        (!q ||
          [
            titleOf(comparison),
            comparison.sizeLabel,
            ...comparison.stores.flatMap((s) => s.brands),
          ].some((value) => value?.toLowerCase().includes(q)))
    );
    // Already sorted by biggest savings
    if (sort === 'savings') return filtered;
    return [...filtered].sort((a, b) =>
      sort === 'name'
        ? titleOf(a).localeCompare(titleOf(b))
        : purchaseCount(b) - purchaseCount(a)
    );
  }, [comparisons, query, store, sort]);

  const toggleStore = (storeKey: string) => {
    setOpenStores((current) => {
      const next = new Set(current);
      if (next.has(storeKey)) next.delete(storeKey);
      else next.add(storeKey);
      return next;
    });
  };

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div
          role="group"
          aria-label="Compare by"
          className="inline-flex rounded-lg border p-1"
        >
          {MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              aria-current={mode.byType === byType ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode.byType === byType
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode.label}
            </Link>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={byType ? 'Search item types or brands' : 'Search items'}
          aria-label="Search compared items"
          className="min-w-0 flex-1 basis-48 rounded-lg border px-3 py-2"
        />
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          aria-label="Only items bought at"
          className="rounded-lg border px-3 py-2"
        >
          <option value="">All stores</option>
          {storeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort compared items"
          className="rounded-lg border px-3 py-2"
        >
          <option value="savings">Biggest savings</option>
          <option value="most-bought">Most bought</option>
          <option value="name">Name</option>
        </select>
        <p className="w-full text-xs text-gray-500">
          {visible.length} item{visible.length === 1 ? '' : 's'} bought at 2+
          stores
          {byType ? ', pooled across brands' : ''}. Typical prices leave out
          sales; items with a weight or volume are compared per lb, oz or gallon.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          {comparisons.length === 0
            ? 'No comparable items yet. Buy the same item at two different stores to compare prices.'
            : 'No items match your search'}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {visible.map((comparison) => {
            const itemKey = comparison.key;
            const isExpanded = expandedItem === itemKey;
            const { bestRegular, regularSavings, lowestPaid } = comparison;
            // Items with a weight or volume are compared per lb, oz, gal...
            const per = comparison.priceUnit ? `/${comparison.priceUnit}` : '';
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
                {/* The whole row toggles; the name links to the item's page */}
                <div
                  onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="font-medium">
                      <Link
                        href={itemHref(itemKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-blue-600 hover:underline"
                      >
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
                      </Link>
                      {comparison.sizeLabel && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">
                          {comparison.sizeLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Found at {comparison.stores.length} stores
                      {bestRegular && regularSavings > 0.5 && (
                        <span className="ml-2 text-green-600 font-medium">
                          Save ${regularSavings.toFixed(2)}
                          {per} by shopping at {bestRegular.store_name}
                        </span>
                      )}
                      {!bestRegular && lowestPaid.on_sale && (
                        <span className="ml-2 text-amber-700">
                          Lowest price was a sale
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Hide' : 'Show'} store prices for ${titleOf(comparison)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedItem(isExpanded ? null : itemKey);
                    }}
                    className="flex items-center gap-4 rounded"
                  >
                    <div className="text-right">
                      {bestRegular ? (
                        <>
                          <div className="text-sm text-gray-500">
                            Best regular price
                          </div>
                          <div className="text-lg font-bold text-green-600">
                            ${bestRegular.price.toFixed(2)}
                            {per}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-500">
                            Lowest paid
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              lowestPaid.on_sale
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            ${lowestPaid.price.toFixed(2)}
                            {per}
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
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="space-y-2">
                      {comparison.stores.map((store) => {
                        const isBest =
                          bestRegular?.store_name === store.store_name;
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
                                    {isStoreOpen
                                      ? 'Hide purchases'
                                      : 'View purchases'}
                                  </button>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                {store.regular_price !== null ? (
                                  <div className="text-lg font-semibold">
                                    ${store.regular_price.toFixed(2)}
                                    {per}
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500">
                                    Regular price unknown
                                  </div>
                                )}
                                {priceVsBest > 0 && (
                                  <div className="text-xs text-red-600">
                                    +${priceVsBest.toFixed(2)}
                                    {per}
                                  </div>
                                )}
                                {store.sale_price !== null && (
                                  <div className="text-xs font-medium text-amber-700">
                                    ${store.sale_price.toFixed(2)}
                                    {per} on sale
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

                    <Link
                      href={itemHref(itemKey)}
                      className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      See price history →
                    </Link>

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
                              <strong>${regularSavings.toFixed(2)}</strong>{' '}
                              {comparison.priceUnit ? `per ${comparison.priceUnit}` : 'per item'} by
                              buying this at{' '}
                              <strong>{bestRegular.store_name}</strong> instead
                              of {priciestRegular.store_name}.
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
      )}
    </div>
  );
}
