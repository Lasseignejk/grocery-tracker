'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useItemSuggestions } from '@/lib/hooks/use-item-suggestions';
import AutocompleteInput from '@/components/ui/autocomplete-input';

interface AddItemProps {
  receiptId: string;
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

export default function AddItem({ receiptId }: AddItemProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [itemName, setItemName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [brand, setBrand] = useState('');
  const [variant, setVariant] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [totalPrice, setTotalPrice] = useState('0');
  const [wasOnSale, setWasOnSale] = useState(false);
  const [category, setCategory] = useState('other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { suggestions } = useItemSuggestions();

  const handleSave = async () => {
    if (!itemName.trim()) {
      setError('Item name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('receipt_items')
        .insert({
          receipt_id: receiptId,
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
        });

      if (insertError) throw insertError;

      // Reset form
      setItemName('');
      setGenericName('');
      setBrand('');
      setVariant('');
      setSize('');
      setUnit('');
      setQuantity('1');
      setUnitPrice('0');
      setTotalPrice('0');
      setWasOnSale(false);
      setCategory('other');
      setIsAdding(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setItemName('');
    setGenericName('');
    setBrand('');
    setVariant('');
    setSize('');
    setUnit('');
    setQuantity('1');
    setUnitPrice('0');
    setTotalPrice('0');
    setWasOnSale(false);
    setCategory('other');
    setIsAdding(false);
    setError(null);
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600"
      >
        + Add Item
      </button>
    );
  }

  return (
    <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
      <h3 className="font-semibold mb-3">Add New Item</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name (Full Description) *
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g., Sprite 2L Bottle, Shiitake Mushrooms 8oz"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            Include size/package info
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AutocompleteInput
            id="generic-name-add"
            label="Generic Name"
            value={genericName}
            onChange={setGenericName}
            suggestions={suggestions.genericNames}
            placeholder="e.g., soda, mushrooms"
            helpText="What type of product?"
          />

          <AutocompleteInput
            id="brand-add"
            label="Brand (optional)"
            value={brand}
            onChange={setBrand}
            suggestions={suggestions.brands}
            placeholder="e.g., sprite, coffeemate"
            helpText="Leave empty for produce"
          />
        </div>

        <div>
          <AutocompleteInput
            id="variant-add"
            label="Variant / Variety (optional)"
            value={variant}
            onChange={setVariant}
            suggestions={suggestions.variants}
            placeholder="e.g., shiitake, organic, lemon-lime"
            helpText="Flavor, variety, or type"
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
            <p className="text-xs text-gray-500 mt-1">How many purchased</p>
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
            id="was-on-sale-add"
            type="checkbox"
            checked={wasOnSale}
            onChange={(e) => setWasOnSale(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="was-on-sale-add"
            className="ml-2 text-sm text-gray-700"
          >
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
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
        >
          {saving ? 'Adding...' : 'Add Item'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
