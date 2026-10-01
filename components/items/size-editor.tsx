'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import type { Purchase } from '@/lib/items';

interface SizeEditorProps {
  purchases: Purchase[];
  // Shown in the label when the list is limited to one store
  storeName?: string;
}

const COMMON_UNITS = ['oz', 'fl oz', 'lb', 'g', 'kg', 'gallon', 'count', 'pack'];

function mostCommonSize(purchases: Purchase[]): { size: string; unit: string } {
  const counts = new Map<string, number>();
  for (const p of purchases) {
    if (!p.size && !p.unit) continue;
    const key = JSON.stringify([p.size ?? '', p.unit ?? '']);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = Array.from(counts).sort(([, a], [, b]) => b - a)[0]?.[0];
  if (!best) return { size: '', unit: '' };
  const [size, unit] = JSON.parse(best) as [string, string];
  return { size, unit };
}

// Sets the same size and unit on every purchase in the list at once
export default function SizeEditor({ purchases, storeName }: SizeEditorProps) {
  const initial = mostCommonSize(purchases);
  const [size, setSize] = useState(initial.size);
  const [unit, setUnit] = useState(initial.unit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApply = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await createClient()
        .from('receipt_items')
        .update({ size: size.trim() || null, unit: unit.trim() || null })
        .in(
          'id',
          purchases.map((p) => p.id)
        );
      if (updateError) throw updateError;
      setMessage(
        `Updated ${purchases.length} purchase${purchases.length === 1 ? '' : 's'}`
      );
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not update the size'));
    } finally {
      setSaving(false);
    }
  };

  const unitListId = `size-units-${purchases[0]?.id}`;

  return (
    <form
      onSubmit={handleApply}
      className="flex flex-wrap items-end gap-2 border-b pb-3 pt-2 text-sm"
    >
      <span className="w-full text-xs font-medium text-gray-600">
        Set size for {storeName ? `all ${storeName} purchases` : 'all purchases'}{' '}
        below ({purchases.length})
      </span>
      <label className="sr-only" htmlFor={`${unitListId}-size`}>
        Size
      </label>
      <input
        id={`${unitListId}-size`}
        value={size}
        onChange={(e) => setSize(e.target.value)}
        placeholder="Size, e.g. 16"
        className="w-28 rounded border px-2 py-1"
      />
      <label className="sr-only" htmlFor={`${unitListId}-unit`}>
        Unit
      </label>
      <input
        id={`${unitListId}-unit`}
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        list={unitListId}
        placeholder="Unit, e.g. oz"
        className="w-28 rounded border px-2 py-1"
      />
      <datalist id={unitListId}>
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Apply'}
      </button>
      {message && <span className="text-green-700">{message}</span>}
      {error && <span className="text-red-600">{error}</span>}
    </form>
  );
}
