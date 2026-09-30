import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from '@/components/auth/logout-button';
import StoreLogoUpload from '@/components/admin/store-logo-upload';
import Nav from '@/components/layout/nav';
import { isAdmin } from '@/lib/auth';

export default async function AdminStoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin and pass true to Nav (we know they're admin if they got here)
  if (!(await isAdmin(user.id))) {
    redirect('/dashboard');
  }

  // Get all stores
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Manage Store Logos</h2>
          <p className="text-gray-600 mt-1">
            Add logos and colors for stores. Changes apply site-wide.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <h3 className="font-semibold">
              All Stores ({stores?.length || 0})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Stores are auto-created from your receipts
            </p>
          </div>

          <div className="divide-y">
            {stores?.map((store) => (
              <div key={store.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center gap-6">
                  {/* Logo Preview */}
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: store.color + '20' }}
                  >
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt={store.name}
                        className="h-14 object-contain"
                      />
                    ) : (
                      <div className="text-3xl">🏪</div>
                    )}
                  </div>

                  {/* Store Info */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{store.name}</h4>
                    <p className="text-sm text-gray-500">
                      Normalized: {store.normalized_name}
                    </p>
                  </div>

                  {/* Upload Component */}
                  <StoreLogoUpload store={store} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">
            💡 How to add logos:
          </h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Find a store logo image (PNG or SVG works best)</li>
            <li>Upload it to Supabase Storage in a "store-logos" bucket</li>
            <li>Copy the public URL</li>
            <li>Paste it into the Logo URL field here</li>
            <li>Optionally set a brand color (hex code)</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
