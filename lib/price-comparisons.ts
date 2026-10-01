// Builds cross-store price comparisons from grouped products. Sale and
// regular prices are kept apart: a one-off sale price says little about
// what the item will cost next time, so "best price" only compares
// regular prices.
import { capitalizeWords, type Product, type Purchase } from '@/lib/items';

export interface StorePrice {
  store_name: string;
  // Distinct brands bought here, most bought first ("No brand" for store/unbranded)
  brands: string[];
  // Average price per unit when not on sale; null if only bought on sale
  regular_price: number | null;
  // Lowest price per unit paid on sale; null if never bought on sale
  sale_price: number | null;
  avg_size: string | null;
  avg_unit: string | null;
  purchase_count: number;
  sale_count: number;
  purchases: Purchase[]; // newest first
}

export interface PriceComparisonEntry {
  key: string;
  generic_name: string | null;
  brand: string | null;
  variant: string | null;
  stores: StorePrice[]; // cheapest regular price first, sale-only stores last
  // Set when at least two stores have a regular price to compare
  bestRegular: { store_name: string; price: number } | null;
  regularSavings: number;
  // The cheapest price ever paid, at any store, sale or not
  lowestPaid: { store_name: string; price: number; on_sale: boolean };
}

// Price for one unit, so buying two at once doesn't double the price
export function unitPrice(purchase: Purchase): number {
  const quantity =
    purchase.quantity && purchase.quantity > 0 ? purchase.quantity : 1;
  return purchase.total_price / quantity;
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : null;
}

function brandsOf(purchases: Purchase[]): string[] {
  const counts = new Map<string, number>();
  for (const p of purchases) {
    const brand = p.brand ? capitalizeWords(p.brand) : 'No brand';
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return Array.from(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([brand]) => brand);
}

/**
 * Pools products by generic name alone ("cream cheese"), across every brand
 * and variant, so store brands can be compared with name brands.
 */
export function groupByItemType(products: Product[]): Product[] {
  const byType = new Map<string, Product[]>();
  for (const product of products) {
    if (!product.generic_name) continue;
    const group = byType.get(product.generic_name);
    if (group) group.push(product);
    else byType.set(product.generic_name, [product]);
  }

  return Array.from(byType, ([genericName, group]) => {
    const purchases = group
      .flatMap((p) => p.purchases)
      .sort((a, b) =>
        (b.purchase_date ?? '').localeCompare(a.purchase_date ?? '')
      );
    const totalSpent = purchases.reduce((sum, p) => sum + p.total_price, 0);
    return {
      key: `type:${genericName}`,
      brand: null,
      generic_name: genericName,
      variant: null,
      name: capitalizeWords(genericName),
      category: group[0].category,
      purchases,
      totalSpent,
      avgPrice: totalSpent / purchases.length,
      stores: Array.from(new Set(purchases.map((p) => p.store_name))),
      lastPurchased: purchases[0]?.purchase_date ?? null,
      receiptTexts: group.flatMap((p) => p.receiptTexts),
    };
  });
}

function purchaseCount(entry: PriceComparisonEntry): number {
  return entry.stores.reduce((n, s) => n + s.purchase_count, 0);
}

export function buildPriceComparisons(
  products: Product[]
): PriceComparisonEntry[] {
  return products
    .map((product) => {
      const byStore = new Map<string, Purchase[]>();
      for (const purchase of product.purchases) {
        const list = byStore.get(purchase.store_name);
        if (list) list.push(purchase);
        else byStore.set(purchase.store_name, [purchase]);
      }

      const stores: StorePrice[] = Array.from(
        byStore,
        ([store_name, purchases]) => {
          const regular = purchases.filter((p) => !p.was_on_sale).map(unitPrice);
          const sale = purchases.filter((p) => p.was_on_sale).map(unitPrice);
          return {
            store_name,
            brands: brandsOf(purchases),
            regular_price: average(regular),
            sale_price: sale.length > 0 ? Math.min(...sale) : null,
            avg_size: purchases.find((p) => p.size)?.size ?? null,
            avg_unit: purchases.find((p) => p.unit)?.unit ?? null,
            purchase_count: purchases.length,
            sale_count: sale.length,
            purchases,
          };
        }
      ).sort(
        (a, b) =>
          (a.regular_price ?? Infinity) - (b.regular_price ?? Infinity) ||
          (a.sale_price ?? Infinity) - (b.sale_price ?? Infinity)
      );

      const withRegular = stores.filter((s) => s.regular_price !== null);
      const bestRegular =
        withRegular.length >= 2
          ? {
              store_name: withRegular[0].store_name,
              price: withRegular[0].regular_price!,
            }
          : null;
      const regularSavings = bestRegular
        ? withRegular[withRegular.length - 1].regular_price! - bestRegular.price
        : 0;

      const cheapestPurchase = product.purchases.reduce((min, p) =>
        unitPrice(p) < unitPrice(min) ? p : min
      );

      return {
        key: product.key,
        generic_name: product.generic_name,
        brand: product.brand,
        variant: product.variant,
        stores,
        bestRegular,
        regularSavings,
        lowestPaid: {
          store_name: cheapestPurchase.store_name,
          price: unitPrice(cheapestPurchase),
          on_sale: cheapestPurchase.was_on_sale,
        },
      };
    })
    .filter((item) => item.stores.length >= 2) // Only show items found at 2+ stores
    // Biggest reliable (regular price) savings first, then most bought
    .sort(
      (a, b) =>
        b.regularSavings - a.regularSavings ||
        purchaseCount(b) - purchaseCount(a)
    );
}
