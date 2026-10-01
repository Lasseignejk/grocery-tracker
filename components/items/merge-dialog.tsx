'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AutocompleteInput from '@/components/ui/autocomplete-input';
import { CATEGORIES } from '@/lib/categories';
import { getErrorMessage } from '@/lib/errors';
import { capitalizeWords, describeProduct, type Product } from '@/lib/items';

export interface FieldSuggestions {
  brands: string[];
  genericNames: string[];
  variants: string[];
}

interface MergeDialogProps {
  // One product means "edit"; two or more means "merge"
  products: Product[];
  // Other sizes of the same products; renaming is by name, so they change too
  otherSizes?: Product[];
  suggestions: FieldSuggestions;
  onClose: () => void;
  onMerged: () => void;
}

export default function MergeDialog({
  products,
  otherSizes = [],
  suggestions,
  onClose,
  onMerged,
}: MergeDialogProps) {
  const isMerge = products.length > 1;
  // Default to keeping the most-bought product's name
  const initial = [...products].sort(
    (a, b) => b.purchases.length - a.purchases.length
  )[0];

  const [keepKey, setKeepKey] = useState(initial.key);
  const [itemName, setItemName] = useState(initial.name);
  const [brand, setBrand] = useState(capitalizeWords(initial.brand));
  const [genericName, setGenericName] = useState(
    capitalizeWords(initial.generic_name)
  );
  const [variant, setVariant] = useState(capitalizeWords(initial.variant));
  const [category, setCategory] = useState('');
  const allTexts = Array.from(
    new Map(
      products
        .flatMap((p) => p.receiptTexts)
        .map((text) => [text.toLowerCase(), text])
    ).values()
  );
  const [rememberTexts, setRememberTexts] = useState(() => new Set(allTexts));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const purchaseCount = [...products, ...otherSizes].reduce(
    (n, p) => n + p.purchases.length,
    0
  );

  const keepName = (product: Product) => {
    setKeepKey(product.key);
    setItemName(product.name);
    setBrand(capitalizeWords(product.brand));
    setGenericName(capitalizeWords(product.generic_name));
    setVariant(capitalizeWords(product.variant));
  };

  const toggleText = (text: string) => {
    setRememberTexts((current) => {
      const next = new Set(current);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!itemName.trim()) {
      setError('Give the item a name.');
      return;
    }
    if (!brand.trim() && !genericName.trim()) {
      setError('Add a brand or a generic name so the item can be grouped.');
      return;
    }

    setSaving(true);
    try {
      const { error: mergeError } = await createClient().rpc('merge_items', {
        sources: products.map((p) => ({
          brand: p.brand,
          generic_name: p.generic_name,
          variant: p.variant,
        })),
        target: {
          item_name: itemName.trim(),
          brand: brand.trim() || null,
          generic_name: genericName.trim() || null,
          variant: variant.trim() || null,
          category: category || null,
        },
        remember_texts: Array.from(rememberTexts),
      });
      if (mergeError) throw mergeError;

      onMerged();
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Something went wrong'));
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-2xl rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {isMerge ? `Merge ${products.length} items` : 'Edit item'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Updates {purchaseCount} purchase{purchaseCount === 1 ? '' : 's'}.
            Future receipts will be renamed to match.
          </p>
          {otherSizes.length > 0 && (
            <p className="mt-1 text-sm text-gray-600">
              Includes other sizes (
              {otherSizes.map((p) => p.sizeLabel).join(', ')}), which stay
              separate by size.
            </p>
          )}
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-4">
          {isMerge && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">
                Start from
              </legend>
              <div className="space-y-2">
                {products.map((product) => (
                  <label
                    key={product.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      keepKey === product.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="keep"
                      checked={keepKey === product.key}
                      onChange={() => keepName(product)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{product.name}</span>
                      <span className="block text-xs text-gray-500">
                        {describeProduct(product)}
                      </span>
                    </span>
                    <span className="text-sm text-gray-500">
                      {product.purchases.length}×
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="merge-item-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Item name
              </label>
              <input
                id="merge-item-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <AutocompleteInput
                id="merge-brand"
                label="Brand"
                value={brand}
                onChange={setBrand}
                suggestions={suggestions.brands}
              />
              <AutocompleteInput
                id="merge-generic-name"
                label="Generic name"
                value={genericName}
                onChange={setGenericName}
                suggestions={suggestions.genericNames}
              />
              <AutocompleteInput
                id="merge-variant"
                label="Variant"
                value={variant}
                onChange={setVariant}
                suggestions={suggestions.variants}
              />
            </div>
            <div>
              <label
                htmlFor="merge-category"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Category
              </label>
              <select
                id="merge-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">Leave as is</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {capitalizeWords(cat.replace('-', ' '))}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {allTexts.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">
                Recognize these printed lines on future receipts
              </legend>
              <p className="mb-2 text-xs text-gray-500">
                Untick generic lines (like &quot;PRODUCE&quot;) that could be
                other items.
              </p>
              <div className="flex flex-wrap gap-2">
                {allTexts.map((text) => (
                  <label
                    key={text}
                    className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1 font-mono text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={rememberTexts.has(text)}
                      onChange={() => toggleText(text)}
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
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
            {saving ? 'Saving…' : isMerge ? 'Merge' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
