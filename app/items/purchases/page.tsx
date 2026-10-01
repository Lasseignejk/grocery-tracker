import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/layout/nav';
import ItemsHeader from '@/components/items/items-header';
import PurchasesTable from '@/components/items/purchases-table';
import { isAdmin } from '@/lib/auth';
import { fetchItemLines } from '@/lib/items-data';

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; product?: string }>;
}) {
  const { store, product } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);
  const lines = await fetchItemLines(supabase, user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ItemsHeader />
        <PurchasesTable
          lines={lines}
          initialStore={store}
          initialProduct={product}
        />
      </main>
    </div>
  );
}
