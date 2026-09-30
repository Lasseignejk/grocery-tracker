import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import ParseButton from '@/components/receipts/parse-button';
import EditReceiptDetails from '@/components/receipts/edit-receipt-details';
import EditItem from '@/components/receipts/edit-item';
import AddItem from '@/components/receipts/add-item';
import DeleteReceiptButton from '@/components/receipts/delete-receipt-button';
import { itemsMatchTotal } from '@/lib/receipt-parser';

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: receipt, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !receipt) {
    notFound();
  }

  // Get receipt items
  const { data: items } = await supabase
    .from('receipt_items')
    .select('*')
    .eq('receipt_id', receipt.id)
    .order('created_at', { ascending: true });

  const hasItems = items && items.length > 0;

  // Warn while the items don't add up to what the receipt says was paid.
  // Subtotal and tax only exist in the parser's raw output, not as columns.
  const itemsSum =
    Math.round(
      (items ?? []).reduce((sum, item) => sum + (item.total_price || 0), 0) * 100
    ) / 100;
  let parsedTotals: {
    subtotal?: number | null;
    tax?: number | null;
    order_discounts?: number | null;
  } = {};
  try {
    parsedTotals = receipt.raw_text ? JSON.parse(receipt.raw_text) : {};
  } catch {
    // Older receipts may not have parseable raw output
  }
  const showTotalsWarning =
    hasItems &&
    receipt.total_amount != null &&
    !itemsMatchTotal(itemsSum, {
      subtotal: parsedTotals.subtotal ?? null,
      tax: parsedTotals.tax ?? null,
      order_discounts: parsedTotals.order_discounts ?? 0,
      total_amount: receipt.total_amount,
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Dashboard
            </Link>
            <DeleteReceiptButton
              receiptId={receipt.id}
              storeName={receipt.store_name}
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receipt Image */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              {receipt.additional_image_urls.length > 0
                ? `Receipt Photos (${receipt.additional_image_urls.length + 1})`
                : 'Receipt Image'}
            </h2>
            <div className="space-y-4">
              {[receipt.image_url, ...receipt.additional_image_urls]
                .filter(Boolean)
                .map((url, index) => (
                  <img
                    key={url}
                    src={url!}
                    alt={`Receipt photo ${index + 1}`}
                    className="w-full rounded-lg"
                  />
                ))}
            </div>
          </div>

          {/* Receipt Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Receipt Details</h2>
              <EditReceiptDetails receipt={receipt} />

              {/* Parse Button */}
              <div className="mt-6 pt-6 border-t">
                <ParseButton receiptId={receipt.id} />
                <p className="text-xs text-gray-500 mt-2">
                  Re-parse if the AI made mistakes or if you want to try again
                </p>
              </div>
            </div>

            {/* Items List */}
            {hasItems && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                  Items ({items.length})
                </h2>
                {showTotalsWarning && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <p className="font-medium text-amber-900">
                      ⚠️ Items don&apos;t add up to the receipt total
                    </p>
                    <p className="mt-1">
                      The items add up to ${itemsSum.toFixed(2)}, but the
                      receipt total is ${receipt.total_amount!.toFixed(2)}.
                      Some prices may be wrong or an item may be missing.
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  {items.map((item) => (
                    <EditItem key={item.id} item={item} />
                  ))}
                  <AddItem receiptId={receipt.id} />
                </div>
              </div>
            )}

            {!hasItems && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Items</h2>
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-gray-600 mb-4">
                    No items yet. Parse the receipt or add items manually.
                  </p>
                </div>
                <AddItem receiptId={receipt.id} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
