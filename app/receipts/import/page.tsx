import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import Nav from '@/components/layout/nav';
import BulkImport from '@/components/receipts/bulk-import';

export default async function ImportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const userIsAdmin = await isAdmin(user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Bulk Import</h2>
          <p className="text-gray-600 mt-1">
            Upload a batch of receipt photos. Each one is read automatically,
            three at a time.
          </p>
        </div>
        <BulkImport />
      </main>
    </div>
  );
}
