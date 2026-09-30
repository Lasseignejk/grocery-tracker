'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/auth/logout-button';

interface NavProps {
  userEmail: string;
  isAdmin: boolean; // ✅ Add this prop
}

export default function Nav({ userEmail, isAdmin }: NavProps) {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  const getLinkClass = (path: string) =>
    `font-medium border-b-2 ${
      pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
        ? 'text-blue-600 border-blue-600'
        : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
    } transition-colors`;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">
              Grocery Tracker{isAdminPage ? ' - Admin' : ''}
            </h1>
            {isAdminPage ? (
              <div className="flex gap-4 text-sm">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Dashboard
                </Link>
                <Link
                  href="/admin/stores"
                  className={getLinkClass('/admin/stores')}
                >
                  Stores
                </Link>
                <Link
                  href="/admin/api-logs"
                  className={getLinkClass('/admin/api-logs')}
                >
                  API Logs
                </Link>
              </div>
            ) : (
              <div className="flex gap-4">
                <Link href="/dashboard" className={getLinkClass('/dashboard')}>
                  Receipts
                </Link>
                <Link href="/analytics" className={getLinkClass('/analytics')}>
                  Analytics
                </Link>
                <Link href="/stores" className={getLinkClass('/stores')}>
                  Stores
                </Link>
                {/* ✅ Only show admin link if user is admin */}
                {isAdmin && (
                  <Link
                    href="/admin/stores"
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
                  >
                    ⚙️ Admin
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
