import Link from 'next/link';
import { formatPurchaseDate, type Purchase } from '@/lib/items';

interface PurchaseListProps {
  purchases: Purchase[];
  // Hide the store column when every purchase is from the same store
  showStore?: boolean;
}

// Every individual purchase behind a product, with a link to its receipt
export default function PurchaseList({
  purchases,
  showStore = true,
}: PurchaseListProps) {
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {purchases.map((purchase) => (
        <li
          key={purchase.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
        >
          <span className="w-28 shrink-0 text-gray-700">
            {formatPurchaseDate(purchase.purchase_date)}
          </span>
          {showStore && (
            <span className="w-32 shrink-0 truncate text-gray-700">
              {purchase.store_name}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-gray-900">
              {purchase.item_name}
            </span>
            {purchase.receipt_text && (
              <span className="block truncate font-mono text-xs text-gray-500">
                {purchase.receipt_text}
              </span>
            )}
          </span>
          {purchase.was_on_sale && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
              Sale
            </span>
          )}
          <span className="w-16 shrink-0 text-right font-semibold">
            ${purchase.total_price.toFixed(2)}
          </span>
          {purchase.receipt_id && (
            <Link
              href={`/receipts/${purchase.receipt_id}#item-${purchase.id}`}
              className="shrink-0 text-blue-600 hover:text-blue-700"
            >
              View receipt →
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
