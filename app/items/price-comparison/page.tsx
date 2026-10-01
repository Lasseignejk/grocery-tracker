import { redirect } from 'next/navigation';
import Link from 'next/link';
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

const MODES = [
  { by: 'product', label: 'Exact product', href: '/items/price-comparison' },
  { by: 'type', label: 'Item type', href: '/items/price-comparison?by=type' },
];

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

        <div
          role="group"
          aria-label="Compare by"
          className="mb-4 inline-flex rounded-lg border bg-white p-1"
        >
          {MODES.map((mode) => {
            const isActive = (mode.by === 'type') === byType;
            return (
              <Link
                key={mode.by}
                href={mode.href}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {mode.label}
              </Link>
            );
          })}
        </div>

        <PriceComparison comparisons={priceComparisons} byType={byType} />
      </main>
    </div>
  );
}
