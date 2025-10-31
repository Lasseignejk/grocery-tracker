import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from '@/components/auth/logout-button';
import UploadReceipt from '@/components/receipts/upload-receipt';
import ReceiptList from '@/components/receipts/receipt-list';
import Nav from '@/components/layout/nav';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email!} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <UploadReceipt />
          </div>

          {/* Receipts List Section */}
          <div className="lg:col-span-2">
            <ReceiptList />
          </div>
        </div>
      </main>
    </div>
  );
}
