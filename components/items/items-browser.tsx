'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import MergeDialog, { type FieldSuggestions } from '@/components/items/merge-dialog';
import PurchaseList from '@/components/items/purchase-list';
import SizeEditor from '@/components/items/size-editor';
import {
  describeProduct,
  formatPurchaseDate,
  itemHref,
  type DuplicateSuggestion,
  type Product,
} from '@/lib/items';

interface ItemsBrowserProps {
  products: Product[];
  duplicates: DuplicateSuggestion[];
}

type SortKey = 'most-bought' | 'most-spent' | 'recent' | 'name';

const PAGE_SIZE = 50;

function matches(product: Product, query: string): boolean {
  return [
    product.name,
    product.brand,
    product.generic_name,
    product.variant,
    ...product.receiptTexts,
  ].some((value) => value?.toLowerCase().includes(query));
}

// Limits a product to its purchases at one store, with stats to match
function scopeToStore(product: Product, store: string): Product | null {
  const purchases = product.purchases.filter((p) => p.store_name === store);
  if (purchases.length === 0) return null;
  const totalSpent = purchases.reduce((sum, p) => sum + p.total_price, 0);
  return {
    ...product,
    purchases,
    totalSpent,
    avgPrice: totalSpent / purchases.length,
    stores: [store],
    lastPurchased: purchases.find((p) => p.purchase_date)?.purchase_date ?? null,
  };
}

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

export default function ItemsBrowser({ products, duplicates }: ItemsBrowserProps) {
  const [query, setQuery] = useState('');
  const [store, setStore] = useState('');
  const [sort, setSort] = useState<SortKey>('most-bought');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialogProducts, setDialogProducts] = useState<Product[] | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const byKey = useMemo(
    () => new Map(products.map((product) => [product.key, product])),
    [products]
  );

  // Stores by how many purchases were made there
  const storeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const purchase of product.purchases) {
        counts.set(
          purchase.store_name,
          (counts.get(purchase.store_name) ?? 0) + 1
        );
      }
    }
    return Array.from(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }, [products]);

  const suggestions: FieldSuggestions = useMemo(
    () => ({
      brands: uniqueSorted(products.map((p) => p.brand)),
      genericNames: uniqueSorted(products.map((p) => p.generic_name)),
      variants: uniqueSorted(products.map((p) => p.variant)),
    }),
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inStore = store
      ? products
          .map((p) => scopeToStore(p, store))
          .filter((p): p is Product => !!p)
      : products;
    const filtered = q ? inStore.filter((p) => matches(p, q)) : inStore;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'most-spent':
          return b.totalSpent - a.totalSpent;
        case 'recent':
          return (b.lastPurchased ?? '').localeCompare(a.lastPurchased ?? '');
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return b.purchases.length - a.purchases.length;
      }
    });
  }, [products, query, sort, store]);

  // Selections can outlive a merge; only count products that still exist
  const selectedProducts = Array.from(selected)
    .map((key) => byKey.get(key))
    .filter((p): p is Product => !!p);

  const toggleSelected = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Sizes of the dialog's products that weren't picked but share their name
  const otherSizes = useMemo(() => {
    if (!dialogProducts) return [];
    const keys = new Set(dialogProducts.map((p) => p.key));
    const bases = new Set(dialogProducts.map((p) => p.baseKey));
    return products.filter((p) => bases.has(p.baseKey) && !keys.has(p.key));
  }, [dialogProducts, products]);

  const openDuplicate = (suggestion: DuplicateSuggestion) => {
    const found = suggestion.productKeys
      .map((key) => byKey.get(key))
      .filter((p): p is Product => !!p);
    if (found.length > 0) setDialogProducts(found);
  };

  return (
    <div className="space-y-6">
      {duplicates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50">
          <button
            onClick={() => setShowDuplicates((open) => !open)}
            aria-expanded={showDuplicates}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="font-medium text-amber-900">
                {duplicates.length} possible duplicate
                {duplicates.length === 1 ? '' : 's'}
              </span>
              <span className="ml-2 text-sm text-amber-800">
                The same printed receipt line was saved as different items
              </span>
            </span>
            <span className="text-sm text-amber-800">
              {showDuplicates ? 'Hide' : 'Review'}
            </span>
          </button>

          {showDuplicates && (
            <ul className="divide-y divide-amber-200 border-t border-amber-200">
              {duplicates.map((suggestion) => (
                <li
                  key={suggestion.productKeys.join('\n')}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-amber-900">
                      {suggestion.receiptTexts.join(', ')}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {suggestion.productKeys.map((key) => {
                        const product = byKey.get(key);
                        if (!product) return null;
                        return (
                          <span
                            key={key}
                            className="rounded bg-white px-2 py-0.5 text-sm text-gray-800 shadow-sm"
                          >
                            {product.name}{' '}
                            <span className="text-gray-500">
                              {product.purchases.length}×
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => openDuplicate(suggestion)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    Merge these
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg bg-white shadow">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search by name, brand, or receipt text"
            aria-label="Search items"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2"
          />
          <select
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            aria-label="Filter by store"
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
            aria-label="Sort items"
            className="rounded-lg border px-3 py-2"
          >
            <option value="most-bought">Most bought</option>
            <option value="most-spent">Most spent</option>
            <option value="recent">Recently bought</option>
            <option value="name">Name</option>
          </select>
          <span className="text-sm text-gray-500">
            {visible.length} item{visible.length === 1 ? '' : 's'}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {products.length === 0
              ? 'Upload receipts to see your items here'
              : store && !query.trim()
                ? `No items bought at ${store}`
                : 'No items match your search'}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.slice(0, limit).map((product) => {
              const isExpanded = expanded === product.key;
              return (
                <li key={product.key}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(product.key)}
                      onChange={() => toggleSelected(product.key)}
                      aria-label={`Select ${product.name}`}
                      className="h-4 w-4"
                    />
                    <button
                      onClick={() =>
                        setExpanded(isExpanded ? null : product.key)
                      }
                      aria-expanded={isExpanded}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-left"
                    >
                      <span className="min-w-0 flex-1 basis-60">
                        <span className="block truncate font-medium">
                          {product.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {describeProduct(product)}
                        </span>
                      </span>
                      <span className="w-20 text-sm text-gray-600">
                        {product.purchases.length}× bought
                      </span>
                      <span className="w-24 text-sm">
                        <span className="font-semibold">
                          ${product.totalSpent.toFixed(2)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          ${product.avgPrice.toFixed(2)} avg
                        </span>
                      </span>
                      <span className="w-36 truncate text-sm text-gray-600">
                        {product.stores.slice(0, 2).join(', ')}
                        {product.stores.length > 2 &&
                          ` +${product.stores.length - 2}`}
                      </span>
                      <span className="w-28 text-sm text-gray-500">
                        {formatPurchaseDate(product.lastPurchased)}
                      </span>
                    </button>
                    <Link
                      href={itemHref(product.key)}
                      className="rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Details
                    </Link>
                    <button
                      onClick={() =>
                        setDialogProducts([byKey.get(product.key) ?? product])
                      }
                      className="rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t bg-gray-50 px-4 py-2 sm:pl-11">
                      <div className="flex flex-wrap items-start justify-between gap-x-4">
                        <SizeEditor
                          purchases={product.purchases}
                          storeName={store || undefined}
                        />
                        <Link
                          href={`/items/purchases?${new URLSearchParams({
                            product: product.key,
                            ...(store ? { store } : {}),
                          })}`}
                          className="pt-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          Edit individually →
                        </Link>
                      </div>
                      <PurchaseList
                        purchases={product.purchases}
                        showStore={!store}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {visible.length > limit && (
          <div className="border-t p-4 text-center">
            <button
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Show more ({visible.length - limit} left)
            </button>
          </div>
        )}
      </div>

      {selectedProducts.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
          <span className="text-sm">
            {selectedProducts.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded px-3 py-1.5 text-sm hover:bg-gray-800"
            >
              Clear
            </button>
            <button
              onClick={() => setDialogProducts(selectedProducts)}
              disabled={selectedProducts.length < 2}
              title={
                selectedProducts.length < 2
                  ? 'Select at least two items to merge'
                  : undefined
              }
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Merge {selectedProducts.length}
            </button>
          </div>
        </div>
      )}

      {dialogProducts && (
        <MergeDialog
          products={dialogProducts}
          otherSizes={otherSizes}
          suggestions={suggestions}
          onClose={() => setDialogProducts(null)}
          onMerged={() => {
            setDialogProducts(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
