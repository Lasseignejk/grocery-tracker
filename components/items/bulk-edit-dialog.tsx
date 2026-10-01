'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/categories';
import { getErrorMessage } from '@/lib/errors';
import { capitalizeWords, type ItemLine } from '@/lib/items';
import type { TablesUpdate } from '@/lib/database.types';

type TextField =
  | 'item_name'
  | 'brand'
  | 'generic_name'
  | 'variant'
  | 'size'
  | 'unit';
type Field = TextField | 'category' | 'quantity' | 'price' | 'was_on_sale';

const TEXT_FIELDS: Array<{ field: TextField; label: string }> = [
  { field: 'item_name', label: 'Item name' },
  { field: 'brand', label: 'Brand' },
  { field: 'generic_name', label: 'Generic name' },
  { field: 'variant', label: 'Variant' },
  { field: 'size', label: 'Size' },
  { field: 'unit', label: 'Unit' },
];

// Long id lists go in the request URL, so update in batches
const BATCH_SIZE = 200;

interface BulkEditDialogProps {
  lines: ItemLine[];
  onClose: () => void;
  onSaved: () => void;
}

// Shared value of a field across the selection, or '' if they differ
function sharedValue(lines: ItemLine[], read: (line: ItemLine) => unknown) {
  const values = new Set(lines.map((line) => String(read(line) ?? '')));
  return values.size === 1 ? Array.from(values)[0] : '';
}

export default function BulkEditDialog({
  lines,
  onClose,
  onSaved,
}: BulkEditDialogProps) {
  const [enabled, setEnabled] = useState<Set<Field>>(new Set());
  const [values, setValues] = useState(() => ({
    item_name: sharedValue(lines, (l) => l.item_name),
    brand: capitalizeWords(sharedValue(lines, (l) => l.brand)),
    generic_name: capitalizeWords(sharedValue(lines, (l) => l.generic_name)),
    variant: capitalizeWords(sharedValue(lines, (l) => l.variant)),
    size: sharedValue(lines, (l) => l.size),
    unit: sharedValue(lines, (l) => l.unit),
    category: sharedValue(lines, (l) => l.category) || 'other',
    quantity: sharedValue(lines, (l) => l.quantity) || '1',
    price: sharedValue(lines, (l) => l.unit_price),
    was_on_sale: sharedValue(lines, (l) => l.was_on_sale) || 'false',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const toggle = (field: Field) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const setValue = (field: Field, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (enabled.size === 0) {
      setError('Tick at least one field to change.');
      return;
    }
    if (enabled.has('item_name') && !values.item_name.trim()) {
      setError('Item name can’t be empty.');
      return;
    }
    const quantity = Number(values.quantity);
    const price = Number(values.price);
    if (enabled.has('quantity') && !(quantity > 0)) {
      setError('Quantity must be more than 0.');
      return;
    }
    if (enabled.has('price') && (values.price.trim() === '' || !(price >= 0))) {
      setError('Enter a price of 0 or more.');
      return;
    }

    // Fields that are the same for every selected line
    const patch: TablesUpdate<'receipt_items'> = {};
    for (const { field } of TEXT_FIELDS) {
      if (!enabled.has(field)) continue;
      if (field === 'item_name') patch.item_name = values.item_name.trim();
      else patch[field] = values[field].trim() || null;
    }
    if (enabled.has('category')) patch.category = values.category;
    if (enabled.has('was_on_sale'))
      patch.was_on_sale = values.was_on_sale === 'true';

    // Totals depend on each line's quantity and price, so lines are grouped
    // by the resulting quantity/price and each group is updated together
    const groups = new Map<
      string,
      { patch: TablesUpdate<'receipt_items'>; ids: string[] }
    >();
    for (const line of lines) {
      let linePatch = patch;
      if (enabled.has('quantity') || enabled.has('price')) {
        const currentQuantity =
          line.quantity && line.quantity > 0 ? line.quantity : 1;
        const lineQuantity = enabled.has('quantity') ? quantity : currentQuantity;
        const linePrice = enabled.has('price')
          ? price
          : (line.unit_price ?? (line.total_price ?? 0) / currentQuantity);
        linePatch = {
          ...patch,
          quantity: lineQuantity,
          unit_price: linePrice,
          total_price: Math.round(linePrice * lineQuantity * 100) / 100,
        };
      }
      const key = JSON.stringify(linePatch);
      const group = groups.get(key);
      if (group) group.ids.push(line.id);
      else groups.set(key, { patch: linePatch, ids: [line.id] });
    }

    setSaving(true);
    try {
      const supabase = createClient();
      for (const { patch: groupPatch, ids } of groups.values()) {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const { error: updateError } = await supabase
            .from('receipt_items')
            .update(groupPatch)
            .in('id', ids.slice(i, i + BATCH_SIZE));
          if (updateError) throw updateError;
        }
      }
      onSaved();
      router.refresh();
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, 'Something went wrong') +
          ' Some purchases may already have been updated.'
      );
      setSaving(false);
    }
  };

  const fieldRow = (field: Field, label: string, input: React.ReactNode) => (
    <div key={field} className="flex items-center gap-3">
      <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={enabled.has(field)}
          onChange={() => toggle(field)}
        />
        {label}
      </label>
      {/* Clicking into a field ticks it */}
      <div
        onFocus={() => !enabled.has(field) && toggle(field)}
        className={`flex-1 ${enabled.has(field) ? '' : 'opacity-40'}`}
      >
        {input}
      </div>
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-xl rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            Edit {lines.length} purchase{lines.length === 1 ? '' : 's'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Tick the fields to change. Unticked fields stay as they are on
            each purchase. Blank fields show where the selection differs.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto px-6 py-4">
          {TEXT_FIELDS.map(({ field, label }) =>
            fieldRow(
              field,
              label,
              <input
                value={values[field]}
                onChange={(e) => setValue(field, e.target.value)}
                aria-label={label}
                className="w-full rounded border px-2 py-1"
              />
            )
          )}
          {fieldRow(
            'category',
            'Category',
            <select
              value={values.category}
              onChange={(e) => setValue('category', e.target.value)}
              aria-label="Category"
              className="w-full rounded border px-2 py-1"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {capitalizeWords(cat.replace('-', ' '))}
                </option>
              ))}
            </select>
          )}
          {fieldRow(
            'quantity',
            'Quantity',
            <input
              type="number"
              step="any"
              min="0"
              value={values.quantity}
              onChange={(e) => setValue('quantity', e.target.value)}
              aria-label="Quantity"
              className="w-full rounded border px-2 py-1"
            />
          )}
          {fieldRow(
            'price',
            'Price each',
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.price}
              onChange={(e) => setValue('price', e.target.value)}
              aria-label="Price each"
              className="w-full rounded border px-2 py-1"
            />
          )}
          {fieldRow(
            'was_on_sale',
            'On sale',
            <select
              value={values.was_on_sale}
              onChange={(e) => setValue('was_on_sale', e.target.value)}
              aria-label="On sale"
              className="w-full rounded border px-2 py-1"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          )}
          {(enabled.has('quantity') || enabled.has('price')) && (
            <p className="text-xs text-gray-500">
              Each purchase&apos;s total is recalculated as price each ×
              quantity.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? 'Saving…'
              : `Update ${lines.length} purchase${lines.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
