'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PageTabsProps {
  tabs: Array<{ href: string; label: string }>;
}

export default function PageTabs({ tabs }: PageTabsProps) {
  const pathname = usePathname();

  return (
    // The gray baseline is an inset shadow rather than a border so the active
    // underline can sit on it without overflowing (which would add a vertical
    // scrollbar, since overflow-x-auto makes the y axis scrollable too)
    <div className="flex gap-6 mb-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-gray-200)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`pb-2 whitespace-nowrap font-medium border-b-2 transition-colors ${
              isActive
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
