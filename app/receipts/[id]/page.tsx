import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import ParseButton from '@/components/receipts/parse-button';
import EditReceiptDetails from '@/components/receipts/edit-receipt-details';
import EditItem from '@/components/receipts/edit-item';
import AddItem from '@/components/receipts/add-item';
import DeleteReceiptButton from '@/components/receipts/delete-receipt-button';

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
            <h2 className="text-xl font-bold mb-4">Receipt Image</h2>
            {receipt.image_url && (
              <img
                src={receipt.image_url}
                alt="Receipt"
                className="w-full rounded-lg"
              />
            )}
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
