import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from '@/components/auth/logout-button';

export default async function StoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get all receipts grouped by store
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id);

  // Get stores with logos
  const { data: stores } = await supabase.from('stores').select('*');

  // Calculate stats per store
  const storeStats = receipts
    ? Object.entries(
        receipts.reduce((acc, receipt) => {
          const storeName = receipt.store_name || 'Unknown Store';
          if (!acc[storeName]) {
            acc[storeName] = {
              name: storeName,
              totalSpent: 0,
              visitCount: 0,
              receipts: [],
            };
          }
          acc[storeName].totalSpent += receipt.total_amount || 0;
          acc[storeName].visitCount += 1;
          acc[storeName].receipts.push(receipt);
          return acc;
        }, {} as Record<string, any>)
      )
        .map(([name, stats]) => {
          const store = stores?.find(
            (s) => s.name.toLowerCase() === name.toLowerCase()
          );
          return {
            ...stats,
            logo_url: store?.logo_url,
            color: store?.color || '#3b82f6',
            avgReceiptTotal: stats.totalSpent / stats.visitCount,
            lastVisit: stats.receipts.sort(
              (a: any, b: any) =>
                new Date(b.purchase_date || b.created_at).getTime() -
                new Date(a.purchase_date || a.created_at).getTime()
            )[0]?.purchase_date,
          };
        })
        .sort((a, b) => b.visitCount - a.visitCount)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold">Receipt Tracker</h1>
              <div className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Receipts
                </Link>
                <Link
                  href="/analytics"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Analytics
                </Link>
                <Link
                  href="/stores"
                  className="text-blue-600 font-medium border-b-2 border-blue-600"
                >
                  Stores
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Store Analytics</h2>
          <p className="text-gray-600 mt-1">
            Compare your shopping habits across different stores
          </p>
        </div>

        {storeStats.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-lg font-semibold mb-2">No stores yet</h3>
            <p className="text-gray-600">
              Upload receipts to see store analytics
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeStats.map((store) => (
              <Link
                key={store.name}
                href={`/stores/${encodeURIComponent(store.name)}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div
                  className="h-32 flex items-center justify-center relative"
                  style={{ backgroundColor: store.color + '20' }}
                >
                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt={store.name}
                      className="h-20 object-contain"
                    />
                  ) : (
                    <div className="text-6xl">🏪</div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-4">{store.name}</h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Spent</span>
                      <span className="font-semibold text-lg text-blue-600">
                        ${store.totalSpent.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Visits</span>
                      <span className="font-semibold">{store.visitCount}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Avg per Visit
                      </span>
                      <span className="font-semibold">
                        ${store.avgReceiptTotal.toFixed(2)}
                      </span>
                    </div>

                    {store.lastVisit && (
                      <div className="pt-3 border-t text-xs text-gray-500">
                        Last visit:{' '}
                        {new Date(store.lastVisit).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
