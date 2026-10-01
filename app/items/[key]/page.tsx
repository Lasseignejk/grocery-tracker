import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/layout/nav';
import ItemEditButton from '@/components/items/item-edit-button';
import ItemPriceChart, {
  type StoreSeries,
} from '@/components/items/item-price-chart';
import PurchaseList from '@/components/items/purchase-list';
import { isAdmin } from '@/lib/auth';
import { CATEGORY_COLORS } from '@/lib/chart-helpers';
import {
  capitalizeWords,
  describeProduct,
  formatPurchaseDate,
} from '@/lib/items';
import { fetchProducts } from '@/lib/items-data';
import {
  groupByItemType,
  priceTrends,
  priceUnit,
  storePrices,
  unitPrice,
} from '@/lib/price-comparisons';

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

// YYYY-MM-DD as a local timestamp (new Date() would read it as UTC)
function toTime(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: encodedKey } = await params;
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);
  const products = await fetchProducts(supabase, user.id);
  // "type:" keys are an item type pooled across brands (Price Comparison)
  const isType = key.startsWith('type:');
  const product = (isType ? groupByItemType(products) : products).find(
    (p) => p.key === key
  );
  if (!product) {
    notFound();
  }

  const unit = priceUnit(product.purchases);
  const per = unit ? `/${unit}` : ' each';
  const stores = storePrices(product.purchases);
  const trends = priceTrends(stores);
  const colorOf = new Map(
    stores.map((store, index) => [
      store.store_name,
      CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    ])
  );
  const storesWithRegular = stores.filter((s) => s.regular_price !== null);
  const cheapestStore =
    storesWithRegular.length >= 2 ? storesWithRegular[0].store_name : null;

  const series: StoreSeries[] = stores.map((store) => ({
    store_name: store.store_name,
    color: colorOf.get(store.store_name)!,
    points: store.purchases
      .filter((p) => p.purchase_date)
      .map((p) => ({
        t: toTime(p.purchase_date!),
        date: p.purchase_date!,
        price: unitPrice(p),
        on_sale: p.was_on_sale,
        store_name: store.store_name,
      }))
      .sort((a, b) => a.t - b.t),
  }));

  const otherSizes = isType
    ? []
    : products.filter((p) => p.baseKey === product.baseKey && p.key !== key);
  const suggestions = {
    brands: uniqueSorted(products.map((p) => p.brand)),
    genericNames: uniqueSorted(products.map((p) => p.generic_name)),
    variants: uniqueSorted(products.map((p) => p.variant)),
  };

  const stats = [
    { label: 'Times bought', value: String(product.purchases.length) },
    { label: 'Total spent', value: `$${product.totalSpent.toFixed(2)}` },
    { label: 'Last bought', value: formatPurchaseDate(product.lastPurchased) },
    { label: 'Stores', value: String(stores.length) },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link
            href={isType ? '/items/price-comparison?by=type' : '/items'}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← {isType ? 'Price comparison' : 'All items'}
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">
                {product.name}
                {product.sizeLabel && (
                  <span className="ml-3 align-middle rounded bg-gray-200 px-2 py-0.5 text-sm font-normal text-gray-700">
                    {product.sizeLabel}
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-1">
                {isType
                  ? `Every brand and variant of ${capitalizeWords(product.generic_name)}`
                  : describeProduct(product)}
              </p>
            </div>
            {!isType && (
              <ItemEditButton
                product={product}
                otherSizes={otherSizes}
                suggestions={suggestions}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white p-4 shadow">
              <div className="text-xs text-gray-600">{stat.label}</div>
              <div className="mt-1 text-lg font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-lg font-semibold">Prices by store</h3>
          <p className="mb-4 text-sm text-gray-600">
            {unit ? 'Prices are per lb. ' : 'Prices are per item. '}
            The typical price leaves out sales, which are shown separately.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => {
              const last = store.purchases[0];
              const isCheapest = store.store_name === cheapestStore;
              return (
                <div
                  key={store.store_name}
                  className={`rounded-lg border p-4 ${
                    isCheapest ? 'border-green-200 bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOf.get(store.store_name) }}
                      aria-hidden
                    />
                    <span className="font-medium">{store.store_name}</span>
                    {isCheapest && (
                      <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                        CHEAPEST
                      </span>
                    )}
                  </div>
                  {isType && (
                    <div className="mt-0.5 text-sm text-gray-700">
                      {store.brands.join(', ')}
                    </div>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-gray-600">Typical price</dt>
                    <dd className="text-right font-semibold">
                      {store.regular_price !== null
                        ? `$${store.regular_price.toFixed(2)}${per}`
                        : 'Only bought on sale'}
                    </dd>
                    {store.sale_price !== null && (
                      <>
                        <dt className="text-gray-600">Lowest sale</dt>
                        <dd className="text-right font-medium text-amber-700">
                          ${store.sale_price.toFixed(2)}
                          {per}
                        </dd>
                      </>
                    )}
                    <dt className="text-gray-600">Last paid</dt>
                    <dd className="text-right">
                      ${unitPrice(last).toFixed(2)}
                      {per}
                      <span className="block text-xs text-gray-500">
                        {formatPurchaseDate(last.purchase_date)}
                        {last.was_on_sale && ' · sale'}
                      </span>
                    </dd>
                    <dt className="text-gray-600">Times bought</dt>
                    <dd className="text-right">
                      {store.purchase_count}
                      {store.sale_count > 0 && ` (${store.sale_count} on sale)`}
                    </dd>
                  </dl>
                </div>
              );
            })}
          </div>

          {trends.length > 0 && (
            <ul className="mt-4 space-y-2">
              {trends.map((trend) => {
                const rising = trend.percentChange > 0;
                return (
                  <li
                    key={trend.store_name}
                    className={`rounded-lg border p-3 text-sm ${
                      rising
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-green-200 bg-green-50 text-green-900'
                    }`}
                  >
                    The last regular price at {trend.store_name} ($
                    {trend.latest.toFixed(2)}
                    {per}) was{' '}
                    <strong>
                      {Math.abs(trend.percentChange).toFixed(0)}%{' '}
                      {rising ? 'higher' : 'lower'}
                    </strong>{' '}
                    than you usually paid there (${trend.earlierAverage.toFixed(2)}
                    {per}).
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Price over time</h3>
          <ItemPriceChart series={series} per={per} />
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-2 text-lg font-semibold">All purchases</h3>
          <PurchaseList
            purchases={product.purchases}
            showStore={stores.length > 1}
          />
        </section>
      </main>
    </div>
  );
}
