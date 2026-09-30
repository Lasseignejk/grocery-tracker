'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteReceiptButtonProps {
  receiptId: string;
  storeName?: string | null;
  redirectTo?: string;
}

export default function DeleteReceiptButton({
  receiptId,
  storeName,
  redirectTo = '/dashboard',
}: DeleteReceiptButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    const confirmMessage = storeName
      ? `Are you sure you want to delete this receipt from ${storeName}? This will also delete all associated items. This action cannot be undone.`
      : 'Are you sure you want to delete this receipt? This will also delete all associated items. This action cannot be undone.';

    if (!confirm(confirmMessage)) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/delete-receipt', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete receipt');
      }

      // Redirect after successful deletion
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        title="Delete receipt"
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
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        {deleting ? 'Deleting...' : 'Delete Receipt'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
