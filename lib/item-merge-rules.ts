import type { ItemMergeRule } from '@/lib/types';

interface RuleableItem {
  receipt_text: string | null;
  item_name: string;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
}

// Same normalization the database trigger applies: trimmed and lowercased
function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function productKey(
  brand: string | null,
  genericName: string | null,
  variant: string | null
): string {
  return JSON.stringify([brand ?? '', genericName ?? '', variant ?? '']);
}

/**
 * Renames newly parsed items using the user's saved merge rules.
 * A rule for the printed receipt text wins over a rule for the AI's
 * brand/generic name/variant, since the printed text is the stable part.
 */
export function applyMergeRules<T extends RuleableItem>(
  items: T[],
  rules: ItemMergeRule[]
): { items: T[]; appliedCount: number } {
  const byReceiptText = new Map<string, ItemMergeRule>();
  const byProduct = new Map<string, ItemMergeRule>();

  for (const rule of rules) {
    if (rule.match_type === 'receipt_text' && rule.match_receipt_text) {
      byReceiptText.set(rule.match_receipt_text, rule);
    } else if (rule.match_type === 'product') {
      byProduct.set(
        productKey(rule.match_brand, rule.match_generic_name, rule.match_variant),
        rule
      );
    }
  }

  let appliedCount = 0;

  const renamed = items.map((item) => {
    const receiptText = normalize(item.receipt_text);
    const rule =
      (receiptText && byReceiptText.get(receiptText)) ||
      byProduct.get(
        productKey(
          normalize(item.brand),
          normalize(item.generic_name),
          normalize(item.variant)
        )
      );

    if (!rule) return item;

    appliedCount++;
    return {
      ...item,
      item_name: rule.target_item_name,
      brand: rule.target_brand,
      generic_name: rule.target_generic_name,
      variant: rule.target_variant,
    };
  });

  return { items: renamed, appliedCount };
}
