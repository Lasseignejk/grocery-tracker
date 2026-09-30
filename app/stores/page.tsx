import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from '@/components/auth/logout-button';
import PriceComparison from '@/components/stores/price-comparison';
import { isAdmin } from '@/lib/auth';
import Nav from '@/components/layout/nav';

export default async function StoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);

  // Get all receipts grouped by store
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id);

  // Get stores with logos
  const { data: stores } = await supabase.from('stores').select('*');

  // Get all items for price comparison
  const { data: allItems } = await supabase
    .from('receipt_items')
    .select('*, receipts!inner(user_id, store_name)')
    .eq('receipts.user_id', user.id);

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

  // Build price comparisons
  const priceComparisons = allItems
    ? (() => {
        // Group items by generic_name + brand + variant
        const itemGroups = allItems.reduce((acc, item) => {
          // Only include items that have a generic_name or brand
          if (!item.generic_name && !item.brand) return acc;

          const key = `${item.brand || 'no-brand'}_${
            item.generic_name || 'no-generic'
          }_${item.variant || 'no-variant'}`;

          if (!acc[key]) {
            acc[key] = {
              generic_name: item.generic_name,
              brand: item.brand,
              variant: item.variant,
              stores: {} as Record<string, any>,
            };
          }

          const storeName =
            (item as any).receipts.store_name || 'Unknown Store';

          if (!acc[key].stores[storeName]) {
            acc[key].stores[storeName] = {
              store_name: storeName,
              total_price: 0,
              purchase_count: 0,
              sizes: [] as string[],
              units: [] as string[],
            };
          }

          acc[key].stores[storeName].total_price += item.total_price || 0;
          acc[key].stores[storeName].purchase_count += 1;
          if (item.size) acc[key].stores[storeName].sizes.push(item.size);
          if (item.unit) acc[key].stores[storeName].units.push(item.unit);

          return acc;
        }, {} as Record<string, any>);

        // Convert to array and filter for items found at multiple stores
        return Object.values(itemGroups)
          .map((group: any) => {
            const storesArray = Object.values(group.stores).map(
              (store: any) => ({
                store_name: store.store_name,
                avg_price: store.total_price / store.purchase_count,
                avg_size: store.sizes.length > 0 ? store.sizes[0] : null,
                avg_unit: store.units.length > 0 ? store.units[0] : null,
                purchase_count: store.purchase_count,
              })
            );

            return {
              generic_name: group.generic_name,
              brand: group.brand,
              variant: group.variant,
              stores: storesArray,
            };
          })
          .filter((item) => item.stores.length >= 2) // Only show items found at 2+ stores
          .sort((a, b) => {
            // Sort by potential savings (difference between highest and lowest price)
            const aSavings =
              Math.max(...a.stores.map((s: any) => s.avg_price)) -
              Math.min(...a.stores.map((s: any) => s.avg_price));
            const bSavings =
              Math.max(...b.stores.map((s: any) => s.avg_price)) -
              Math.min(...b.stores.map((s: any) => s.avg_price));
            return bSavings - aSavings;
          });
      })()
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Store Analytics</h2>
          <p className="text-gray-600 mt-1">
            Compare your shopping habits across different stores
          </p>
        </div>

        {/* Price Comparisons Section */}
        {priceComparisons.length > 0 && (
          <div className="mb-8">
            <PriceComparison comparisons={priceComparisons} />
          </div>
        )}

        {/* Store Cards */}
        {storeStats.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-lg font-semibold mb-2">No stores yet</h3>
            <p className="text-gray-600">
              Upload receipts to see store analytics
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-bold mb-4">All Stores</h3>
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
                        <span className="text-sm text-gray-600">
                          Total Spent
                        </span>
                        <span className="font-semibold text-lg text-blue-600">
                          ${store.totalSpent.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Visits</span>
                        <span className="font-semibold">
                          {store.visitCount}
                        </span>
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
                          {new Date(store.lastVisit).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
