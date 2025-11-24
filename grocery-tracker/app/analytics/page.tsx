import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SummaryStats from '@/components/analytics/summary-stats';
import SpendingByStore from '@/components/analytics/spending-by-store';
import SpendingByCategory from '@/components/analytics/spending-by-category';
import SpendingOverTime from '@/components/analytics/spending-over-time';
import TopItemsGrouped from '@/components/analytics/top-items-grouped';
import Nav from '@/components/layout/nav';
import { isAdmin } from '@/lib/auth';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);

  // Get all receipts
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id);

  // Get all items
  const { data: items } = await supabase
    .from('receipt_items')
    .select('*, receipts!inner(user_id)')
    .eq('receipts.user_id', user.id);

  // Calculate summary stats
  const totalSpent =
    receipts?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
  const totalReceipts = receipts?.length || 0;
  const totalItems = items?.length || 0;
  const avgReceiptAmount = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

  // Get top store
  const storeSpending = receipts?.reduce((acc, r) => {
    const store = r.store_name || 'Unknown';
    acc[store] = (acc[store] || 0) + (r.total_amount || 0);
    return acc;
  }, {} as Record<string, number>);
  const topStore = storeSpending
    ? Object.entries(storeSpending).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      null
    : null;

  // Get top category
  const categorySpending = items?.reduce((acc, item) => {
    const cat = item.category || 'other';
    acc[cat] = (acc[cat] || 0) + (item.total_price || 0);
    return acc;
  }, {} as Record<string, number>);
  const topCategory = categorySpending
    ? Object.entries(categorySpending).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      null
    : null;

  // Sale items stats
  const saleItems = items?.filter((item) => item.was_on_sale) || [];
  const saleItemsCount = saleItems.length;
  const saleItemsSavings = saleItems.reduce(
    (sum, item) => sum + (item.total_price || 0) * 0.2,
    0
  );

  const stats = {
    totalSpent,
    totalReceipts,
    totalItems,
    avgReceiptAmount,
    topStore,
    topCategory,
    saleItemsCount,
    saleItemsSavings,
  };

  // Spending by store
  const spendingByStore = receipts
    ? Object.entries(
        receipts.reduce((acc, r) => {
          const store = r.store_name || 'Unknown';
          if (!acc[store]) {
            acc[store] = { total: 0, count: 0 };
          }
          acc[store].total += r.total_amount || 0;
          acc[store].count += 1;
          return acc;
        }, {} as Record<string, { total: number; count: number }>)
      )
        .map(([store_name, data]) => ({ store_name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
    : [];

  // Spending by category
  const spendingByCategory = items
    ? Object.entries(
        items.reduce((acc, item) => {
          const cat = item.category || 'other';
          acc[cat] = (acc[cat] || 0) + (item.total_price || 0);
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
    : [];

  // Spending over time
  const spendingOverTime = receipts
    ? Object.entries(
        receipts.reduce((acc, r) => {
          const date =
            r.purchase_date || new Date().toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + (r.total_amount || 0);
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  // Group items by brand
  const groupedByBrand = items
    ? Object.entries(
        items
          .filter((item) => item.brand) // Only items with brands
          .reduce((acc, item) => {
            const brand = item.brand!;
            if (!acc[brand]) {
              acc[brand] = {
                total_spent: 0,
                purchase_count: 0,
                items: [] as Array<{
                  item_name: string;
                  total_spent: number;
                  purchase_count: number;
                }>,
              };
            }
            acc[brand].total_spent += item.total_price || 0;
            acc[brand].purchase_count += 1;

            // Track individual items within brand
            const existingItem = acc[brand].items.find(
              (i) => i.item_name === item.item_name
            );
            if (existingItem) {
              existingItem.total_spent += item.total_price || 0;
              existingItem.purchase_count += 1;
            } else {
              acc[brand].items.push({
                item_name: item.item_name,
                total_spent: item.total_price || 0,
                purchase_count: 1,
              });
            }
            return acc;
          }, {} as Record<string, { total_spent: number; purchase_count: number; items: Array<{ item_name: string; total_spent: number; purchase_count: number }> }>)
      )
        .map(([display_name, data]) => ({
          display_name,
          grouping_field: 'brand' as const,
          ...data,
        }))
        .sort((a, b) => b.purchase_count - a.purchase_count)
    : [];

  // Group items by generic name
  const groupedByGeneric = items
    ? Object.entries(
        items
          .filter((item) => item.generic_name) // Only items with generic names
          .reduce((acc, item) => {
            const generic = item.generic_name!;
            if (!acc[generic]) {
              acc[generic] = {
                total_spent: 0,
                purchase_count: 0,
                items: [] as Array<{
                  item_name: string;
                  total_spent: number;
                  purchase_count: number;
                }>,
              };
            }
            acc[generic].total_spent += item.total_price || 0;
            acc[generic].purchase_count += 1;

            // Track individual items within generic name
            const existingItem = acc[generic].items.find(
              (i) => i.item_name === item.item_name
            );
            if (existingItem) {
              existingItem.total_spent += item.total_price || 0;
              existingItem.purchase_count += 1;
            } else {
              acc[generic].items.push({
                item_name: item.item_name,
                total_spent: item.total_price || 0,
                purchase_count: 1,
              });
            }
            return acc;
          }, {} as Record<string, { total_spent: number; purchase_count: number; items: Array<{ item_name: string; total_spent: number; purchase_count: number }> }>)
      )
        .map(([display_name, data]) => ({
          display_name,
          grouping_field: 'generic_name' as const,
          ...data,
        }))
        .sort((a, b) => b.purchase_count - a.purchase_count)
    : [];

  // Ungrouped items (no brand or generic name)
  const ungroupedItems = items
    ? Object.entries(
        items.reduce((acc, item) => {
          const name = item.item_name;
          if (!acc[name]) {
            acc[name] = { total_spent: 0, purchase_count: 0 };
          }
          acc[name].total_spent += item.total_price || 0;
          acc[name].purchase_count += 1;
          return acc;
        }, {} as Record<string, { total_spent: number; purchase_count: number }>)
      )
        .map(([item_name, data]) => ({ display_name: item_name, ...data }))
        .sort((a, b) => b.purchase_count - a.purchase_count)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Insights from your grocery receipts
          </p>
        </div>

        <div className="space-y-6">
          {/* Summary Stats */}
          <SummaryStats stats={stats} />

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingByStore data={spendingByStore} />
            <SpendingByCategory data={spendingByCategory} />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingOverTime data={spendingOverTime} />
            <TopItemsGrouped
              groupedByBrand={groupedByBrand}
              groupedByGeneric={groupedByGeneric}
              ungroupedItems={ungroupedItems}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
