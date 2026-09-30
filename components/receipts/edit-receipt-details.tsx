'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface EditReceiptDetailsProps {
  receipt: {
    id: string;
    store_name: string | null;
    purchase_date: string | null;
    total_amount: number | null;
  };
}

// Helper function to format date for display (handles timezone properly)
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return 'No date';

  // Parse as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function EditReceiptDetails({
  receipt,
}: EditReceiptDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [storeName, setStoreName] = useState(receipt.store_name || '');
  const [purchaseDate, setPurchaseDate] = useState(receipt.purchase_date || '');
  const [totalAmount, setTotalAmount] = useState(
    receipt.total_amount?.toString() || '0'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          store_name: storeName,
          purchase_date: purchaseDate || null,
          total_amount: parseFloat(totalAmount) || 0,
        })
        .eq('id', receipt.id);

      if (updateError) throw updateError;

      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setStoreName(receipt.store_name || '');
    setPurchaseDate(receipt.purchase_date || '');
    setTotalAmount(receipt.total_amount?.toString() || '0');
    setIsEditing(false);
    setError(null);
  };

  if (!isEditing) {
    return (
      <div>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-600">Store</dt>
            <dd className="text-lg">{receipt.store_name || 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Date</dt>
            <dd className="text-lg">
              {formatDateForDisplay(receipt.purchase_date)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Total</dt>
            <dd className="text-2xl font-bold text-blue-600">
              ${receipt.total_amount?.toFixed(2) || '0.00'}
            </dd>
          </div>
        </dl>
        <button
          onClick={() => setIsEditing(true)}
          className="mt-4 w-full px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit Details
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="store-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Store Name
          </label>
          <input
            id="store-name"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="purchase-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Purchase Date
          </label>
          <input
            id="purchase-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Selected:{' '}
            {purchaseDate
              ? formatDateForDisplay(purchaseDate)
              : 'No date selected'}
          </p>
        </div>

        <div>
          <label
            htmlFor="total-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Total Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              id="total-amount"
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
