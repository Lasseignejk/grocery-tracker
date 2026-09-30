import { createClient } from '@/lib/supabase/server';
import { Receipt } from '@/lib/types';
import Link from 'next/link';
import DeleteReceiptButton from './delete-receipt-button';

// Helper function to format date for display (handles timezone properly)
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return 'No date';

  // Parse as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function ReceiptList() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="text-red-600">
        Error loading receipts: {error.message}
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-6xl mb-4">📸</div>
        <h3 className="text-lg font-semibold mb-2">No receipts yet</h3>
        <p className="text-gray-600">
          Upload your first receipt to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">Your Receipts</h2>
        <p className="text-sm text-gray-600 mt-1">
          {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} uploaded
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {receipts.map((receipt: Receipt) => (
          <div
            key={receipt.id}
            className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
          >
            <Link href={`/receipts/${receipt.id}`}>
              {receipt.image_url && (
                <div className="aspect-[3/4] bg-gray-100">
                  <img
                    src={receipt.image_url}
                    alt="Receipt"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold mb-1">
                  {receipt.store_name || 'Unknown Store'}
                </h3>
                <p className="text-sm text-gray-600">
                  {formatDateForDisplay(receipt.purchase_date)}
                </p>
                {receipt.total_amount !== null && receipt.total_amount > 0 && (
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    ${receipt.total_amount.toFixed(2)}
                  </p>
                )}
              </div>
            </Link>
            <div className="px-4 pb-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <DeleteReceiptButton
                receiptId={receipt.id}
                storeName={receipt.store_name}
                redirectTo="/dashboard"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
