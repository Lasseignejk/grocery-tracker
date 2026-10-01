import PageTabs from '@/components/layout/page-tabs';

const ITEMS_TABS = [
  { href: '/items', label: 'All Items' },
  { href: '/items/purchases', label: 'All Purchases' },
  { href: '/items/price-comparison', label: 'Price Comparison' },
  { href: '/items/rules', label: 'Merge Rules' },
];

// Heading and tabs shared by the Items pages
export default function ItemsHeader() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Items</h2>
        <p className="text-gray-600 mt-1">
          Browse everything you&apos;ve bought and clean up duplicates
        </p>
      </div>
      <PageTabs tabs={ITEMS_TABS} />
    </>
  );
}
