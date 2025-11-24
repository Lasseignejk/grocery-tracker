'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ReceiptItem } from '@/lib/types';
import { useItemSuggestions } from '@/lib/hooks/use-item-suggestions';
import AutocompleteInput from '@/components/ui/autocomplete-input';
import LinkItemsDialog from './link-items-dialog';

interface EditItemProps {
  item: ReceiptItem;
}

const CATEGORIES = [
  'bakery',
  'beverages',
  'bread',
  'cans',
  'dairy and eggs',
  'frozen',
  'household',
  'meat',
  'personal-care',
  'pet',
  'produce',
  'snacks',
  'other',
];

// Helper function to capitalize first letter of each word
function capitalizeWords(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function EditItem({ item }: EditItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [itemName, setItemName] = useState(item.item_name);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [genericName, setGenericName] = useState(item.generic_name || '');
  const [brand, setBrand] = useState(item.brand || '');
  const [variant, setVariant] = useState(item.variant || '');
  const [size, setSize] = useState(item.size || '');
  const [unit, setUnit] = useState(item.unit || '');
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '1');
  const [unitPrice, setUnitPrice] = useState(
    item.unit_price?.toString() || '0'
  );
  const [totalPrice, setTotalPrice] = useState(
    item.total_price?.toString() || '0'
  );
  const [wasOnSale, setWasOnSale] = useState(item.was_on_sale);
  const [category, setCategory] = useState(item.category || 'other');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { suggestions } = useItemSuggestions();

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('receipt_items')
        .update({
          item_name: itemName,
          generic_name: genericName.trim() || null,
          brand: brand.trim() || null,
          variant: variant.trim() || null,
          size: size.trim() || null,
          unit: unit.trim() || null,
          quantity: parseFloat(quantity) || 1,
          unit_price: parseFloat(unitPrice) || 0,
          total_price: parseFloat(totalPrice) || 0,
          was_on_sale: wasOnSale,
          category: category,
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('receipt_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) throw deleteError;

      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setItemName(item.item_name);
    setGenericName(item.generic_name || '');
    setBrand(item.brand || '');
    setVariant(item.variant || '');
    setSize(item.size || '');
    setUnit(item.unit || '');
    setQuantity(item.quantity?.toString() || '1');
    setUnitPrice(item.unit_price?.toString() || '0');
    setTotalPrice(item.total_price?.toString() || '0');
    setWasOnSale(item.was_on_sale);
    setCategory(item.category || 'other');
    setIsEditing(false);
    setError(null);
  };

  if (!isEditing) {
    return (
      <div className="flex justify-between items-start p-3 border rounded-lg hover:bg-gray-50 transition-colors group">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{item.item_name}</p>
            {(item.size || item.unit) && (
              <span className="text-xs text-gray-500">
                ({item.size && item.size}
                {item.size && item.unit && ' '}
                {item.unit && item.unit})
              </span>
            )}
            {item.brand && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {capitalizeWords(item.brand)}
              </span>
            )}
            {item.generic_name && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                {capitalizeWords(item.generic_name)}
              </span>
            )}
            {item.variant && (
              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                {capitalizeWords(item.variant)}
              </span>
            )}
          </div>
          {/* Show receipt text if available */}
          {item.receipt_text && (
            <div className="mt-1 text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
              Receipt: {item.receipt_text}
            </div>
          )}
          <div className="flex gap-3 mt-1 text-sm text-gray-600">
            {item.quantity && <span>Qty: {item.quantity}</span>}
            {item.unit_price && item.unit_price > 0 && (
              <span>@ ${item.unit_price.toFixed(2)}</span>
            )}
            {item.category && (
              <span className="capitalize">{item.category}</span>
            )}
          </div>
          {item.was_on_sale && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
              On Sale
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="font-semibold text-lg">
            ${item.total_price?.toFixed(2) || '0.00'}
          </p>
          <button
            onClick={() => setShowLinkDialog(true)}
            className="opacity-0 group-hover:opacity-100 p-2 text-purple-600 hover:bg-purple-50 rounded transition-all"
            title="Link to product"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit item"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
        {showLinkDialog && (
          <LinkItemsDialog
            itemId={item.id}
            itemName={item.item_name}
            brand={item.brand}
            genericName={item.generic_name}
            onClose={() => setShowLinkDialog(false)}
          />
        )}
        {item.receipt_text &&
          (item.generic_name || item.brand || item.size) && (
            <span
              className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded"
              title="Some fields were auto-filled from previous purchases"
            >
              ✓ Matched
            </span>
          )}
      </div>
    );
  }

  return (
    <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
      <div className="space-y-3">
        {/* Show receipt text at the top when editing */}
        {item.receipt_text && (
          <div className="p-2 bg-gray-100 rounded border border-gray-300">
            <p className="text-xs font-medium text-gray-600 mb-1">
              Original Receipt Text:
            </p>
            <p className="font-mono text-sm text-gray-800">
              {item.receipt_text}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name (Specific)
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g., Coffee Mate Brown Butter Chocolate 32oz"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            Clean, readable product name
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AutocompleteInput
            id="generic-name"
            label="Generic Name"
            value={genericName}
            onChange={setGenericName}
            suggestions={suggestions.genericNames}
            placeholder="e.g., coffee creamer, mushrooms"
            helpText="What type of product is it?"
          />

          <AutocompleteInput
            id="brand"
            label="Brand (optional)"
            value={brand}
            onChange={setBrand}
            suggestions={suggestions.brands}
            placeholder="e.g., coffeemate"
            helpText="Leave empty for produce"
          />
        </div>

        <div>
          <AutocompleteInput
            id="variant"
            label="Variant / Variety (optional)"
            value={variant}
            onChange={setVariant}
            suggestions={suggestions.variants}
            placeholder="e.g., shiitake, brown butter chocolate"
            helpText="Specific variety, flavor, or type"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Size (optional)
            </label>
            <input
              type="text"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g., 2, 12, 32"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Amount/measurement</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit (optional)
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., liter, oz, lb, count"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Unit type</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="was-on-sale"
            type="checkbox"
            checked={wasOnSale}
            onChange={(e) => setWasOnSale(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="was-on-sale" className="ml-2 text-sm text-gray-700">
            This item was on sale
          </label>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-600 rounded text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving || deleting}
          className="flex-1 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={saving || deleting}
          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
          title="Delete item"
        >
          {deleting ? '...' : '🗑️'}
        </button>
      </div>
    </div>
  );
}
