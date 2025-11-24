'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ParseButton({ receiptId }: { receiptId: string }) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hasItems, setHasItems] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Check if receipt already has items
  useEffect(() => {
    async function checkItems() {
      const { data, error } = await supabase
        .from('receipt_items')
        .select('id')
        .eq('receipt_id', receiptId)
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasItems(true);
      }
    }
    checkItems();
  }, [receiptId, supabase]);

  const handleParse = async () => {
    // Show warning if items already exist
    if (hasItems) {
      const confirmed = confirm(
        'This receipt already has items. Re-parsing will delete all existing items and replace them with newly parsed data. Continue?'
      );
      if (!confirmed) return;
    }

    setParsing(true);
    setError(null);
    setWarning(null);

    try {
      const response = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse receipt');
      }

      // Check if parsing was truncated
      if (result.truncated && result.warning) {
        setWarning(result.warning);
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleParse}
        disabled={parsing}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {parsing
          ? 'Parsing with AI...'
          : hasItems
          ? 'Re-parse Receipt with AI'
          : 'Parse Receipt with AI'}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {warning && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-2">
            <span className="text-amber-600">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Partial Parse
              </p>
              <p className="text-sm text-amber-800 mt-1">{warning}</p>
            </div>
          </div>
        </div>
      )}

      {hasItems && !parsing && !warning && (
        <p className="mt-2 text-xs text-amber-600">
          ⚠️ Re-parsing will replace all existing items
        </p>
      )}
    </div>
  );
}
