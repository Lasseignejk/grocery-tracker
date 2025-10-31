import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import StoreItemsChart from '@/components/stores/store-items-chart';
import StoreCategoryBreakdown from '@/components/stores/store-category-breakdown';
import StoreSpendingTrend from '@/components/stores/store-spending-trend';

// Helper function to format date
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return 'Unknown date';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: encodedName } = await params;
  const storeName = decodeURIComponent(encodedName);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get all receipts for this store
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .ilike('store_name', storeName)
    .order('purchase_date', { ascending: false });

  if (error || !receipts || receipts.length === 0) {
    notFound();
  }

  // Get all items from this store
  const receiptIds = receipts.map((r) => r.id);
  const { data: items } = await supabase
    .from('receipt_items')
    .select('*')
    .in('receipt_id', receiptIds);

  // Get store logo
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .ilike('name', storeName)
    .single();

  // Calculate stats
  const totalSpent = receipts.reduce(
    (sum, r) => sum + (r.total_amount || 0),
    0
  );
  const visitCount = receipts.length;
  const avgReceiptTotal = totalSpent / visitCount;
  const totalItems = items?.length || 0;
  const avgItemsPerVisit = totalItems / visitCount;

  // Most purchased items
  const itemCounts = items?.reduce((acc, item) => {
    const name = item.generic_name || item.item_name;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topItems = Object.entries(itemCounts || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category breakdown
  const categorySpending = items?.reduce((acc, item) => {
    const cat = item.category || 'other';
    acc[cat] = (acc[cat] || 0) + (item.total_price || 0);
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categorySpending || {})
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // Spending over time
  const spendingByDate = receipts.reduce((acc, r) => {
    const date = r.purchase_date || new Date().toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + (r.total_amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const spendingTrend = Object.entries(spendingByDate)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Sale items
  const saleItems = items?.filter((item) => item.was_on_sale) || [];
  const saleItemsCount = saleItems.length;
  const saleItemsPercentage =
    totalItems > 0 ? (saleItemsCount / totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link
              href="/stores"
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
              Back to Stores
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Store Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-6">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: store?.color + '20' || '#3b82f620' }}
            >
              {store?.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={storeName}
                  className="h-16 object-contain"
                />
              ) : (
                <div className="text-5xl">🏪</div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{storeName}</h1>
              <p className="text-gray-600">
                Shopping here since{' '}
                {formatDateForDisplay(
                  receipts[receipts.length - 1]?.purchase_date
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Total Spent</div>
            <div className="text-2xl font-bold text-blue-600">
              ${totalSpent.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Visits</div>
            <div className="text-2xl font-bold">{visitCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Avg per Visit</div>
            <div className="text-2xl font-bold">
              ${avgReceiptTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Avg Items</div>
            <div className="text-2xl font-bold">
              {avgItemsPerVisit.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">
              Total Items Purchased
            </div>
            <div className="text-xl font-bold">{totalItems}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Items on Sale</div>
            <div className="text-xl font-bold text-green-600">
              {saleItemsCount} ({saleItemsPercentage.toFixed(1)}%)
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Last Visit</div>
            <div className="text-xl font-bold">
              {formatDateForDisplay(receipts[0]?.purchase_date)}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <StoreItemsChart items={topItems} />
          <StoreCategoryBreakdown data={categoryData} />
        </div>

        <div className="mb-6">
          <StoreSpendingTrend data={spendingTrend} storeName={storeName} />
        </div>

        {/* Recent Receipts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Receipts</h3>
          <div className="space-y-2">
            {receipts.slice(0, 10).map((receipt) => (
              <Link
                key={receipt.id}
                href={`/receipts/${receipt.id}`}
                className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium">
                    {formatDateForDisplay(receipt.purchase_date)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {receipt.created_at
                      ? new Date(receipt.created_at).toLocaleTimeString(
                          'en-US',
                          {
                            hour: 'numeric',
                            minute: '2-digit',
                          }
                        )
                      : ''}
                  </p>
                </div>
                <p className="text-lg font-semibold text-blue-600">
                  ${receipt.total_amount?.toFixed(2) || '0.00'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
