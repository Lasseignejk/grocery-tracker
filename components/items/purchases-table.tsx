'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import BulkEditDialog from '@/components/items/bulk-edit-dialog';
import {
  assignProducts,
  capitalizeWords,
  formatPurchaseDate,
  type ItemLine,
} from '@/lib/items';

interface PurchasesTableProps {
  lines: ItemLine[];
  // Starting filters, e.g. from an "Edit individually" link
  initialStore?: string;
  initialProduct?: string;
}

type SortKey = 'date' | 'store' | 'name' | 'size' | 'price';

const PAGE_SIZE = 100;

const COLUMNS: Array<{ label: string; sort?: SortKey; className?: string }> = [
  { label: 'Date', sort: 'date' },
  { label: 'Store', sort: 'store' },
  { label: 'Item', sort: 'name' },
  { label: 'Brand' },
  { label: 'Generic name' },
  { label: 'Variant' },
  { label: 'Size', sort: 'size' },
  { label: 'Qty', className: 'text-right' },
  { label: 'Price', sort: 'price', className: 'text-right' },
  { label: 'Sale' },
  { label: 'Category' },
  { label: '' },
];

// Turns a product key back into "Brand · Generic · Variant"
function describeProductKey(key: string): string {
  try {
    return (JSON.parse(key) as string[])
      .filter(Boolean)
      .map(capitalizeWords)
      .join(' · ');
  } catch {
    return 'one item';
  }
}

function storeOf(line: ItemLine) {
  return line.receipts.store_name || 'Unknown Store';
}

function sizeOf(line: ItemLine) {
  return [line.size, line.unit].filter(Boolean).join(' ');
}

function matches(line: ItemLine, query: string) {
  return [
    line.item_name,
    line.receipt_text,
    line.brand,
    line.generic_name,
    line.variant,
  ].some((value) => value?.toLowerCase().includes(query));
}

function compare(a: ItemLine, b: ItemLine, sort: SortKey): number {
  switch (sort) {
    case 'store':
      return storeOf(a).localeCompare(storeOf(b));
    case 'name':
      return a.item_name.localeCompare(b.item_name);
    case 'size':
      return sizeOf(a).localeCompare(sizeOf(b), undefined, { numeric: true });
    case 'price':
      return (a.total_price ?? 0) - (b.total_price ?? 0);
    default:
      return (a.receipts.purchase_date ?? '').localeCompare(
        b.receipts.purchase_date ?? ''
      );
  }
}

export default function PurchasesTable({
  lines,
  initialStore = '',
  initialProduct,
}: PurchasesTableProps) {
  const [query, setQuery] = useState('');
  const [store, setStore] = useState(initialStore);
  const [product, setProduct] = useState(initialProduct);
  const [missingSize, setMissingSize] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'date',
    desc: true,
  });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const storeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) {
      counts.set(storeOf(line), (counts.get(storeOf(line)) ?? 0) + 1);
    }
    return Array.from(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }, [lines]);

  const productOf = useMemo(() => assignProducts(lines), [lines]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines
      .filter(
        (line) =>
          (!store || storeOf(line) === store) &&
          (!product || productOf.get(line.id)?.key === product) &&
          (!missingSize || (!line.size && !line.unit)) &&
          (!q || matches(line, q))
      )
      .sort((a, b) => {
        const result = compare(a, b, sort.key);
        return sort.desc ? -result : result;
      });
  }, [lines, productOf, query, store, product, missingSize, sort]);

  const selectedLines = lines.filter((line) => selected.has(line.id));
  const allVisibleSelected =
    visible.length > 0 && visible.every((line) => selected.has(line.id));

  const resetPaging = () => setLimit(PAGE_SIZE);

  // Shift-click selects every row between the last click and this one
  const handleRowCheck = (id: string, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const turnOn = !current.has(id);
      const from = visible.findIndex((line) => line.id === lastClicked);
      const to = visible.findIndex((line) => line.id === id);
      if (shiftKey && from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        for (const line of visible.slice(start, end + 1)) {
          if (turnOn) next.add(line.id);
          else next.delete(line.id);
        }
      } else if (turnOn) next.add(id);
      else next.delete(id);
      return next;
    });
    setLastClicked(id);
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      for (const line of visible) {
        if (allVisibleSelected) next.delete(line.id);
        else next.add(line.id);
      }
      return next;
    });
  };

  const sortBy = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key === 'date' || key === 'price' }
    );

  const productLabel = product ? describeProductKey(product) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            placeholder="Search by name, brand, or receipt text"
            aria-label="Search purchases"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2"
          />
          <select
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
              resetPaging();
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
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={missingSize}
              onChange={(e) => {
                setMissingSize(e.target.checked);
                resetPaging();
              }}
            />
            Missing size
          </label>
          <span className="text-sm text-gray-500">
            {visible.length} purchase{visible.length === 1 ? '' : 's'}
          </span>
        </div>

        {productLabel && (
          <div className="flex items-center gap-2 border-b bg-blue-50 px-4 py-2 text-sm text-blue-900">
            Showing only <strong>{productLabel}</strong>
            <button
              onClick={() => {
                setProduct(undefined);
                resetPaging();
              }}
              className="ml-auto text-blue-700 hover:text-blue-900"
            >
              Show all items
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label={`Select all ${visible.length} matching purchases`}
                    title={`Select all ${visible.length} matching purchases`}
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={
                      column.sort && sort.key === column.sort
                        ? sort.desc
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                    className={`whitespace-nowrap px-3 py-2 font-medium ${column.className ?? ''}`}
                  >
                    {column.sort ? (
                      <button
                        onClick={() => sortBy(column.sort!)}
                        className="uppercase hover:text-gray-900"
                      >
                        {column.label}
                        {sort.key === column.sort && (sort.desc ? ' ↓' : ' ↑')}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.slice(0, limit).map((line) => (
                <tr
                  key={line.id}
                  className={
                    selected.has(line.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(line.id)}
                      onClick={(e) => handleRowCheck(line.id, e.shiftKey)}
                      onChange={() => {}}
                      aria-label={`Select ${line.item_name}`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                    {formatPurchaseDate(line.receipts.purchase_date)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                    {storeOf(line)}
                  </td>
                  <td className="min-w-48 px-3 py-2">
                    <div className="text-gray-900">{line.item_name}</div>
                    {line.receipt_text && (
                      <div className="font-mono text-xs text-gray-500">
                        {line.receipt_text}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {capitalizeWords(line.brand)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {capitalizeWords(line.generic_name)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {capitalizeWords(line.variant)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {sizeOf(line) || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{line.quantity ?? 1}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    ${(line.total_price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {line.was_on_sale && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Sale
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                    {capitalizeWords(line.category?.replace('-', ' '))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {line.receipt_id && (
                      <Link
                        href={`/receipts/${line.receipt_id}#item-${line.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Receipt →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            {lines.length === 0
              ? 'Upload receipts to see your purchases here'
              : 'No purchases match these filters'}
          </div>
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

      {selectedLines.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
          <span className="text-sm">
            {selectedLines.length} selected
            <span className="ml-2 text-gray-400">
              Shift-click to select a range
            </span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded px-3 py-1.5 text-sm hover:bg-gray-800"
            >
              Clear
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
            >
              Edit {selectedLines.length}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <BulkEditDialog
          lines={selectedLines}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
