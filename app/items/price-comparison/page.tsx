import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/layout/nav';
import ItemsHeader from '@/components/items/items-header';
import PriceComparison from '@/components/items/price-comparison';
import { isAdmin } from '@/lib/auth';
import { fetchProducts } from '@/lib/items-data';
import {
  buildPriceComparisons,
  groupByItemType,
} from '@/lib/price-comparisons';

export default async function PriceComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const { by } = await searchParams;
  const byType = by === 'type';

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);
  const products = await fetchProducts(supabase, user.id);
  const priceComparisons = buildPriceComparisons(
    byType ? groupByItemType(products) : products
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ItemsHeader />

        <PriceComparison comparisons={priceComparisons} byType={byType} />
      </main>
    </div>
  );
}
