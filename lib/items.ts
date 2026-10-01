// Groups receipt lines into products (same brand + generic name + variant)
// for the Items pages, and spots likely duplicate products.

// A receipt line joined with the receipt it came from
export interface ItemLine {
  id: string;
  receipt_id: string | null;
  item_name: string;
  receipt_text: string | null;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  category: string | null;
  total_price: number | null;
  unit_price: number | null;
  quantity: number | null;
  size: string | null;
  unit: string | null;
  was_on_sale: boolean | null;
  receipts: { store_name: string | null; purchase_date: string | null };
}

export interface Purchase {
  id: string;
  receipt_id: string | null;
  item_name: string;
  brand: string | null;
  variant: string | null;
  receipt_text: string | null;
  total_price: number;
  quantity: number | null;
  size: string | null;
  unit: string | null;
  was_on_sale: boolean;
  store_name: string;
  purchase_date: string | null;
}

export interface Product {
  key: string;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  // Most common item name / category among its purchases
  name: string;
  category: string | null;
  purchases: Purchase[]; // newest first
  totalSpent: number;
  avgPrice: number;
  stores: string[]; // most visited first
  lastPurchased: string | null;
  // Distinct printed lines (compared case-insensitively)
  receiptTexts: string[];
}

export interface DuplicateSuggestion {
  receiptTexts: string[];
  productKeys: string[];
}

// Column select for fetching ItemLine rows from receipt_items
export const ITEM_LINE_SELECT =
  'id, receipt_id, item_name, receipt_text, brand, generic_name, variant, category, total_price, unit_price, quantity, size, unit, was_on_sale, receipts!inner(user_id, store_name, purchase_date)';

export function productKey(
  brand: string | null,
  genericName: string | null,
  variant: string | null
): string {
  return JSON.stringify([brand ?? '', genericName ?? '', variant ?? '']);
}

export function capitalizeWords(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Parses YYYY-MM-DD as a local date; new Date() would treat it as UTC
// midnight and show the previous day in US time zones
export function formatPurchaseDate(dateString: string | null): string {
  if (!dateString) return 'Unknown date';
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

// Newest first; purchases without a date go last
function byNewest(a: Purchase, b: Purchase): number {
  if (a.purchase_date === b.purchase_date) return 0;
  if (!a.purchase_date) return 1;
  if (!b.purchase_date) return -1;
  return b.purchase_date.localeCompare(a.purchase_date);
}

export function groupIntoProducts(lines: ItemLine[]): Product[] {
  const groups = new Map<string, ItemLine[]>();
  for (const line of lines) {
    const key = productKey(line.brand, line.generic_name, line.variant);
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }

  return Array.from(groups, ([key, group]) => {
    const purchases: Purchase[] = group
      .map((line) => ({
        id: line.id,
        receipt_id: line.receipt_id,
        item_name: line.item_name,
        brand: line.brand,
        variant: line.variant,
        receipt_text: line.receipt_text,
        total_price: line.total_price ?? 0,
        quantity: line.quantity,
        size: line.size,
        unit: line.unit,
        was_on_sale: line.was_on_sale ?? false,
        store_name: line.receipts.store_name || 'Unknown Store',
        purchase_date: line.receipts.purchase_date,
      }))
      .sort(byNewest);

    const storeCounts = new Map<string, number>();
    const receiptTexts = new Map<string, string>();
    for (const purchase of purchases) {
      storeCounts.set(
        purchase.store_name,
        (storeCounts.get(purchase.store_name) ?? 0) + 1
      );
      const text = purchase.receipt_text?.trim();
      if (text && !receiptTexts.has(text.toLowerCase())) {
        receiptTexts.set(text.toLowerCase(), text);
      }
    }

    const totalSpent = purchases.reduce((sum, p) => sum + p.total_price, 0);
    const first = group[0];

    return {
      key,
      brand: first.brand,
      generic_name: first.generic_name,
      variant: first.variant,
      name: mostCommon(group.map((line) => line.item_name)) ?? first.item_name,
      category: mostCommon(group.map((line) => line.category)),
      purchases,
      totalSpent,
      avgPrice: totalSpent / purchases.length,
      stores: Array.from(storeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([store]) => store),
      lastPurchased: purchases.find((p) => p.purchase_date)?.purchase_date ?? null,
      receiptTexts: Array.from(receiptTexts.values()),
    };
  });
}

/**
 * Finds printed receipt lines that ended up under more than one product,
 * e.g. "Str/Blu Shredwheat" saved as three different variants. Texts that
 * point at the same set of products are combined into one suggestion.
 */
export function findDuplicateSuggestions(
  products: Product[]
): DuplicateSuggestion[] {
  const productsByText = new Map<string, Set<string>>();
  const displayText = new Map<string, string>();

  for (const product of products) {
    for (const original of product.receiptTexts) {
      const normalized = original.toLowerCase();
      if (!productsByText.has(normalized)) {
        productsByText.set(normalized, new Set());
        displayText.set(normalized, original);
      }
      productsByText.get(normalized)!.add(product.key);
    }
  }

  const suggestions = new Map<string, DuplicateSuggestion>();
  for (const [normalized, keys] of productsByText) {
    if (keys.size < 2) continue;
    const productKeys = Array.from(keys).sort();
    const setKey = productKeys.join('\n');
    const existing = suggestions.get(setKey);
    if (existing) existing.receiptTexts.push(displayText.get(normalized)!);
    else
      suggestions.set(setKey, {
        receiptTexts: [displayText.get(normalized)!],
        productKeys,
      });
  }

  // Biggest groups first
  return Array.from(suggestions.values()).sort(
    (a, b) => b.productKeys.length - a.productKeys.length
  );
}
