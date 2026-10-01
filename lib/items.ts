// Groups receipt lines into products (same brand + generic name + variant,
// split by package size when sizes differ) for the Items pages, and spots
// likely duplicate products.

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
  // Brand + generic name + variant, shared by every size of the product
  baseKey: string;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  // Set when the product was split by size, e.g. "1 gallon" or "Size unknown"
  sizeLabel: string | null;
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

export const UNKNOWN_SIZE = 'Size unknown';
export const PER_LB = 'Per lb';
export const PER_ITEM = 'Per item';

// Sold by weight: the size is how much was weighed, not a package size
const WEIGHED_UNITS = new Set(['lb', 'lbs', 'pound', 'pounds', 'kg']);
const LB_PER_KG = 2.20462;

interface Sized {
  size: string | null;
  unit: string | null;
  quantity: number | null;
}

// Pounds bought, for items sold by weight; null for everything else
export function weightOf(item: Sized): number | null {
  const unit = item.unit?.trim().toLowerCase() ?? '';
  if (!WEIGHED_UNITS.has(unit)) return null;
  const size = Number(item.size);
  if (!Number.isFinite(size) || size <= 0) return null;
  const pounds = unit === 'kg' ? size * LB_PER_KG : size;
  // Loose produce saves its weight as the quantity too; a different
  // whole quantity means several bags of that weight (2 × 3 lb onions)
  const quantity = item.quantity ?? 1;
  return quantity > 1 && Math.abs(quantity - size) > 0.01
    ? pounds * quantity
    : pounds;
}

// "1 gallon" for a packaged size; null when there is none or it was weighed
export function packageSize(
  size: string | null,
  unit: string | null
): string | null {
  const trimmed = size?.trim();
  if (!trimmed) return null;
  const normalizedUnit = unit?.trim().toLowerCase() ?? '';
  if (WEIGHED_UNITS.has(normalizedUnit)) return null;
  // "0.50" and "0.5" are the same size
  const number = Number(trimmed);
  const amount = Number.isFinite(number) ? String(number) : trimmed.toLowerCase();
  return [amount, normalizedUnit].filter(Boolean).join(' ');
}

function groupBy<T>(items: T[], label: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = label(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Splits items of one product so each group has one comparable price.
 * Different package sizes (half gallon vs gallon milk) are kept apart, and
 * items without a size go to "size unknown" so they don't skew either size;
 * with only one known size, unsized items join it. Items bought by weight
 * are priced per lb, so when a product was bought both ways (loose onions
 * and single onions) the weighed ones get their own "per lb" group.
 * A product needing no split comes back as one group under null.
 */
export function splitBySize<T extends Sized>(items: T[]): Map<string | null, T[]> {
  const weighed = items.filter((item) => weightOf(item) !== null);
  const rest = items.filter((item) => weightOf(item) === null);
  const sizes = new Set(
    rest
      .map((item) => packageSize(item.size, item.unit))
      .filter((size): size is string => !!size)
  );

  if (weighed.length === 0 || rest.length === 0) {
    if (sizes.size < 2) return new Map([[null, items]]);
    return groupBy(
      items,
      (item) => packageSize(item.size, item.unit) ?? UNKNOWN_SIZE
    );
  }

  const groups = new Map<string | null, T[]>([[PER_LB, weighed]]);
  const [onlySize] = sizes;
  const restGroups =
    sizes.size < 2
      ? new Map([[onlySize ?? PER_ITEM, rest]])
      : groupBy(rest, (item) => packageSize(item.size, item.unit) ?? UNKNOWN_SIZE);
  for (const [label, group] of restGroups) groups.set(label, group);
  return groups;
}

// Assigns each line to a product: same brand, generic name and variant,
// then split by size
export function assignProducts(
  lines: ItemLine[]
): Map<string, { key: string; baseKey: string; sizeLabel: string | null }> {
  const byBase = new Map<string, ItemLine[]>();
  for (const line of lines) {
    const baseKey = productKey(line.brand, line.generic_name, line.variant);
    const group = byBase.get(baseKey);
    if (group) group.push(line);
    else byBase.set(baseKey, [line]);
  }

  const assigned = new Map<
    string,
    { key: string; baseKey: string; sizeLabel: string | null }
  >();
  for (const [baseKey, group] of byBase) {
    for (const [sizeLabel, sized] of splitBySize(group)) {
      const key = sizeLabel
        ? JSON.stringify([...(JSON.parse(baseKey) as string[]), sizeLabel])
        : baseKey;
      for (const line of sized) {
        assigned.set(line.id, { key, baseKey, sizeLabel });
      }
    }
  }
  return assigned;
}

// "Brand · Generic · Variant · Size" for a product
export function describeProduct(product: {
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  sizeLabel: string | null;
}): string {
  return [product.brand, product.generic_name, product.variant]
    .filter(Boolean)
    .map(capitalizeWords)
    .concat(product.sizeLabel ? [product.sizeLabel] : [])
    .join(' · ');
}

// Link to a product's detail page
export function itemHref(key: string): string {
  return `/items/${encodeURIComponent(key)}`;
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
  const assigned = assignProducts(lines);
  const groups = new Map<string, ItemLine[]>();
  for (const line of lines) {
    const { key } = assigned.get(line.id)!;
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
    const { baseKey, sizeLabel } = assigned.get(first.id)!;

    return {
      key,
      baseKey,
      brand: first.brand,
      generic_name: first.generic_name,
      variant: first.variant,
      sizeLabel,
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
 * Different sizes of one product sharing a printed line are not duplicates.
 */
export function findDuplicateSuggestions(
  products: Product[]
): DuplicateSuggestion[] {
  const productsByText = new Map<string, Set<string>>();
  const basesByText = new Map<string, Set<string>>();
  const displayText = new Map<string, string>();

  for (const product of products) {
    for (const original of product.receiptTexts) {
      const normalized = original.toLowerCase();
      if (!productsByText.has(normalized)) {
        productsByText.set(normalized, new Set());
        basesByText.set(normalized, new Set());
        displayText.set(normalized, original);
      }
      productsByText.get(normalized)!.add(product.key);
      basesByText.get(normalized)!.add(product.baseKey);
    }
  }

  const suggestions = new Map<string, DuplicateSuggestion>();
  for (const [normalized, keys] of productsByText) {
    if (basesByText.get(normalized)!.size < 2) continue;
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
