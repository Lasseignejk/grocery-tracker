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
export const PER_ITEM = 'Per item';

// Sizes that convert to a common measure, so different package sizes can
// be compared by price per oz (or per gallon, per lb...). Amounts are in
// oz for weight and fl oz for volume.
type MeasureKind = 'weight' | 'volume';
const MEASURES: Record<string, { kind: MeasureKind; amount: number }> = {
  oz: { kind: 'weight', amount: 1 },
  ounce: { kind: 'weight', amount: 1 },
  ounces: { kind: 'weight', amount: 1 },
  lb: { kind: 'weight', amount: 16 },
  lbs: { kind: 'weight', amount: 16 },
  pound: { kind: 'weight', amount: 16 },
  pounds: { kind: 'weight', amount: 16 },
  g: { kind: 'weight', amount: 0.035274 },
  gram: { kind: 'weight', amount: 0.035274 },
  grams: { kind: 'weight', amount: 0.035274 },
  kg: { kind: 'weight', amount: 35.274 },
  'fl oz': { kind: 'volume', amount: 1 },
  floz: { kind: 'volume', amount: 1 },
  ml: { kind: 'volume', amount: 0.033814 },
  l: { kind: 'volume', amount: 33.814 },
  liter: { kind: 'volume', amount: 33.814 },
  liters: { kind: 'volume', amount: 33.814 },
  litre: { kind: 'volume', amount: 33.814 },
  cup: { kind: 'volume', amount: 8 },
  cups: { kind: 'volume', amount: 8 },
  pint: { kind: 'volume', amount: 16 },
  quart: { kind: 'volume', amount: 32 },
  gal: { kind: 'volume', amount: 128 },
  gallon: { kind: 'volume', amount: 128 },
  gallons: { kind: 'volume', amount: 128 },
};

// What prices are shown per, with its size in oz / fl oz
export type PriceUnit = 'lb' | 'oz' | 'gal' | 'fl oz';
const PRICE_UNIT_AMOUNT: Record<PriceUnit, number> = {
  lb: 16,
  oz: 1,
  gal: 128,
  'fl oz': 1,
};

interface Sized {
  size: string | null;
  unit: string | null;
  quantity: number | null;
}

function normalizeUnit(unit: string | null): string {
  return unit?.trim().toLowerCase() ?? '';
}

// Total weight (oz) or volume (fl oz) bought; null when the size is missing
// or isn't a measure (12 count, 2 package)
function measureOf(item: Sized): { kind: MeasureKind; amount: number } | null {
  const measure = MEASURES[normalizeUnit(item.unit)];
  const size = Number(item.size);
  if (!measure || !Number.isFinite(size) || size <= 0) return null;
  // Loose produce saves its weight as the quantity too; a different
  // whole quantity means several packages of that size (2 × 3 lb onions)
  const quantity = item.quantity ?? 1;
  const packages =
    quantity > 1 && Math.abs(quantity - size) > 0.01 ? quantity : 1;
  return { kind: measure.kind, amount: size * measure.amount * packages };
}

/**
 * The unit to compare these purchases' prices in: per lb or oz when every
 * one has a weight, per gallon or fl oz when every one has a volume, and
 * null (per item) otherwise. Bigger units are used when every purchase was
 * sized in them, so milk reads per gallon and loose produce per lb.
 */
export function priceUnit(purchases: Sized[]): PriceUnit | null {
  const kinds = new Set(purchases.map((p) => measureOf(p)?.kind ?? null));
  if (purchases.length === 0 || kinds.size !== 1 || kinds.has(null)) {
    return null;
  }
  const units = purchases.map((p) => MEASURES[normalizeUnit(p.unit)].amount);
  if (kinds.has('weight')) {
    return units.every((amount) => amount >= 16) ? 'lb' : 'oz';
  }
  return units.every((amount) => amount === 128) ? 'gal' : 'fl oz';
}

// Price per `unit` when given and the purchase has that kind of size,
// otherwise the price of one item, so buying two doesn't double the price
export function unitPrice(
  purchase: Sized & { total_price: number },
  unit: PriceUnit | null = null
): number {
  const measure = unit ? measureOf(purchase) : null;
  if (unit && measure) {
    return purchase.total_price / (measure.amount / PRICE_UNIT_AMOUNT[unit]);
  }
  const quantity =
    purchase.quantity && purchase.quantity > 0 ? purchase.quantity : 1;
  return purchase.total_price / quantity;
}

// "12 count" for a size that can't be converted to a measure; null when
// there is none or it can (those are compared per oz instead)
export function packageSize(
  size: string | null,
  unit: string | null
): string | null {
  const trimmed = size?.trim();
  if (!trimmed) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (MEASURES[normalizedUnit]) return null;
  // "0.50" and "0.5" are the same size
  const number = Number(trimmed);
  const amount = Number.isFinite(number) ? String(number) : trimmed.toLowerCase();
  return [amount, normalizedUnit].filter(Boolean).join(' ');
}

const KIND_LABELS: Record<MeasureKind, string> = {
  weight: 'By weight',
  volume: 'By volume',
};

/**
 * Splits items of one product so each group has one comparable price.
 * Weights and volumes are compared per unit, so any package size of them
 * stays together (8 oz and 12 oz bags, half gallon and gallon milk). Sizes
 * that can't be converted, like 12 vs 18 count eggs, are kept apart; with
 * only one such size, unsized items join it. Otherwise unsized items get
 * their own group so they don't skew the per-unit prices. A product needing
 * no split comes back as one group under null.
 */
export function splitBySize<T extends Sized>(items: T[]): Map<string | null, T[]> {
  const labelOf = (item: T): string | null => {
    const measure = measureOf(item);
    return measure
      ? KIND_LABELS[measure.kind]
      : packageSize(item.size, item.unit);
  };
  const isMeasure = (label: string) =>
    Object.values(KIND_LABELS).includes(label);

  const labels = new Set(
    items.map(labelOf).filter((label): label is string => !!label)
  );
  const hasUnsized = items.some((item) => !labelOf(item));
  const [onlyLabel] = labels;
  if (
    labels.size === 0 ||
    (labels.size === 1 && (!hasUnsized || !isMeasure(onlyLabel)))
  ) {
    return new Map([[null, items]]);
  }

  const unsizedLabel = [...labels].every(isMeasure) ? PER_ITEM : UNKNOWN_SIZE;
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const label = labelOf(item) ?? unsizedLabel;
    const group = groups.get(label);
    if (group) group.push(item);
    else groups.set(label, [item]);
  }
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
