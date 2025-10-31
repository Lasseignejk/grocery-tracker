'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/auth/logout-button';

interface NavProps {
  userEmail: string;
}

export default function Nav({ userEmail }: NavProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  const getLinkClass = (path: string) =>
    `font-medium border-b-2 ${
      pathname === path || pathname.startsWith(path)
        ? 'text-blue-600 border-blue-600'
        : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
    } transition-colors`;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">
              Grocery Tracker{isAdmin ? '- Admin' : ''}
            </h1>
            {isAdmin ? (
              <Link href="/dashboard" className={getLinkClass('/dashboard')}>
                ← Back to Dashboard
              </Link>
            ) : (
              <div className="flex gap-4">
                <Link href="/dashboard" className={getLinkClass('/dashboard')}>
                  Receipts
                </Link>
                <Link href="/admin/stores" className={getLinkClass('/admin')}>
                  Admin
                </Link>
                <Link href="/analytics" className={getLinkClass('/analytics')}>
                  Analytics
                </Link>
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
