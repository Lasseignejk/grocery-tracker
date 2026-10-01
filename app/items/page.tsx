import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/layout/nav';
import ItemsHeader from '@/components/items/items-header';
import ItemsBrowser from '@/components/items/items-browser';
import { isAdmin } from '@/lib/auth';
import { findDuplicateSuggestions } from '@/lib/items';
import { fetchProducts } from '@/lib/items-data';

export default async function ItemsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);
  const products = await fetchProducts(supabase, user.id);
  const duplicates = findDuplicateSuggestions(products);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ItemsHeader />
        <ItemsBrowser products={products} duplicates={duplicates} />
      </main>
    </div>
  );
}
