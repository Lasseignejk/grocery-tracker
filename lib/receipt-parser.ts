import OpenAI from 'openai';
import { CATEGORIES, type Category } from './categories';

// Models chosen from a side-by-side test on real receipts (2026-09-30):
// gpt-6-luna priced every line correctly at ~1/12 the cost of gpt-4o, and
// gpt-6-sol matched it, so Sol is the second opinion when Luna's items don't
// add up to the printed total.
const PRIMARY = { model: 'gpt-6-luna', reasoning_effort: 'medium' } as const;
const FALLBACK = { model: 'gpt-6-sol', reasoning_effort: 'low' } as const;
type ModelConfig = typeof PRIMARY | typeof FALLBACK;

// USD per 1M tokens (input, output), from OpenAI's pricing page
const PRICES: Record<ModelConfig['model'], [number, number]> = {
  'gpt-6-luna': [0.1, 0.5],
  'gpt-6-sol': [2, 10],
};

// Reasoning tokens count toward this limit, so leave plenty of headroom
const MAX_COMPLETION_TOKENS = 16000;

export interface ParsedItem {
  receipt_text: string;
  item_name: string;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  size: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  was_on_sale: boolean;
  category: Category;
}

export interface ParsedReceipt {
  store_name: string | null;
  purchase_date: string | null;
  subtotal: number | null;
  tax: number | null;
  total_amount: number | null;
  // Discounts on the whole order rather than one item, e.g. loyalty rewards
  order_discounts: number;
  items: ParsedItem[];
}

// One call to the model, successful or not, for api_logs
export interface ParseAttempt {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  finish_reason: string | null;
  response_text: string | null;
  error: string | null;
  items_parsed: number;
  totals_match: boolean;
}

export interface ParseResult {
  data: ParsedReceipt | null;
  attempts: ParseAttempt[];
  itemsSum: number;
  // False when neither model's items added up to the receipt's total
  totalsMatch: boolean;
}

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };

const RECEIPT_SCHEMA = {
  name: 'receipt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'store_name', 'purchase_date', 'subtotal', 'tax', 'total_amount', 'order_discounts', 'items',
    ],
    properties: {
      store_name: nullableString,
      purchase_date: {
        type: ['string', 'null'],
        description: 'YYYY-MM-DD, or null if no date is printed on the receipt',
      },
      subtotal: { ...nullableNumber, description: 'Subtotal before tax as printed, or null' },
      tax: { ...nullableNumber, description: 'Total sales tax as printed, or null' },
      total_amount: { ...nullableNumber, description: 'Final amount paid' },
      order_discounts: {
        type: 'number',
        description:
          "Total of discounts that apply to the whole order rather than a specific item (e.g. rewards like 'Shop&Earn SAVINGS', order coupons), as a positive number. 0 if none. Don't include discounts already subtracted from an item's price.",
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'receipt_text', 'item_name', 'brand', 'generic_name', 'variant', 'size',
            'unit', 'quantity', 'unit_price', 'total_price', 'was_on_sale', 'category',
          ],
          properties: {
            receipt_text: { type: 'string' },
            item_name: { type: 'string' },
            brand: nullableString,
            generic_name: nullableString,
            variant: nullableString,
            size: nullableString,
            unit: nullableString,
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            total_price: { type: 'number' },
            was_on_sale: { type: 'boolean' },
            category: { type: 'string', enum: [...CATEGORIES] },
          },
        },
      },
    },
  },
};

const PROMPT = `Analyze this grocery receipt image and extract the following information in JSON format.

CRITICAL: Return ONLY valid JSON with NO comments, NO explanatory text, NO markdown formatting.

{
  "store_name": "name of the store",
  "purchase_date": "date in YYYY-MM-DD format or null if not visible",
  "total_amount": number,
  "items": [
    {
      "receipt_text": "EXACT text as it appears on the receipt. Do not include price or item numbers",
      "item_name": "full descriptive name including size/package",
      "brand": "brand name or null",
      "generic_name": "generic product type",
      "variant": "specific variety/flavor or null",
      "size": "measurement amount (e.g., '2', '12', '32', '1.5')",
      "unit": "unit type (e.g., 'liter', 'oz', 'lb', 'kg', 'count', 'package')",
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "was_on_sale": boolean,
      "category": "one of: bakery, beverages, bread, cans, dairy and eggs, frozen, household, meat, personal-care, pet, produce, snacks, other"
    }
  ]
}

PARSING GUIDELINES:

1. **Receipt Text**: Exact text as shown on receipt (preserve caps, abbreviations)
2. **Item Name**: Clean, readable version with size info expanded
3. **Brand**: Brand name ONLY for branded products (null for produce)
4. **Generic Name**: Broad category (singular): "miso", "protein bar", "mushroom"
5. **Variant**: Specific type/flavor: "white", "chocolate peanut butter", "shiitake"
6. **Size and Unit**: Extract package size/measurement
   - Size: The numeric amount ("2", "12", "32", "1.5")
   - Unit: The unit type ("liter", "oz", "lb", "kg", "count", "package", "bottle", "can", "bag")
   - If no size visible, use null for both
7. **Prices**: Use the FINAL price paid after all discounts/promotions
8. **Was On Sale**: true if ANY discount indicator present (SALE, *, promotion text)
9. **Category**: Choose the most appropriate category

IMPORTANT FOR LONG RECEIPTS:
- If the receipt has many items and you're running low on response space, prioritize:
  1. Store name, date, and total (essential)
  2. As many complete items as possible
  3. NEVER end with an incomplete item - if you can't fit the whole item, stop at the previous one
- It's better to return 30 complete items than 35 items with the last 5 incomplete

CATEGORIES:
- bakery: pastries, cakes, cookies
- beverages: soda, juice, coffee, tea, alcohol
- bread: bread, bagels
- cans: diced tomatoes, white beans
- dairy and eggs: milk, cheese, yogurt, butter, eggs
- frozen: pizza, steamed vegetables
- household: cleaning, paper products
- meat: meat, poultry, seafood, deli
- personal-care: soap, shampoo, cosmetics
- pet: pet food, pet toys
- produce: fruits, vegetables, herbs
- snacks: chips, candy, cookies, bars
- other: everything else

CRITICAL RULES:
- Return ONLY the JSON object, nothing else
- NO comments in the JSON (no // or /* */)
- NO explanatory text before or after
- NO markdown code fences
- Use null for missing string values
- Use 0 for missing numeric values
- Use false for missing boolean values
- All text fields (brand, generic_name, variant) should be lowercase
- receipt_text preserves original casing
- Extract as many COMPLETE items as possible
- STOP before writing an incomplete item

EXAMPLE (correct format):
{
  "store_name": "Publix",
  "purchase_date": "2025-01-15",
  "total_amount": 16.33,
  "items": [
    {
      "receipt_text": "HIKARI WHITE MISO",
      "item_name": "Hikari White Miso",
      "brand": "hikari",
      "generic_name": "miso",
      "variant": "white",
      "size": null,
      "unit": null,
      "quantity": 1,
      "unit_price": 10.49,
      "total_price": 10.49,
      "was_on_sale": false,
      "category": "other"
    }
  ]
}`;

// Added when a long receipt was photographed in several parts
const multiPartNote = (count: number) => `

MULTIPLE PHOTOS:
These ${count} photos are parts of ONE long receipt. They may be in any order and may overlap, so the same lines can appear in more than one photo. Combine them into a single receipt:
- List every purchased item exactly once. Don't repeat items that appear in two overlapping photos.
- Take the store name and date from whichever photo shows them.
- Take the subtotal, tax and total from whichever photo shows them.`;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumItems(receipt: ParsedReceipt): number {
  return round2(receipt.items.reduce((sum, item) => sum + (item.total_price || 0), 0));
}

// Items should add up to the pre-tax subtotal, or to the total when there's
// no tax. Any of those matching within a cent counts.
export function itemsMatchTotal(
  itemsSum: number,
  totals: Pick<ParsedReceipt, 'subtotal' | 'tax' | 'total_amount'> & {
    order_discounts?: number | null;
  }
): boolean {
  const { subtotal, tax, total_amount } = totals;
  const sum = itemsSum - (totals.order_discounts ?? 0);
  const targets = [
    subtotal,
    total_amount,
    total_amount != null && tax != null ? total_amount - tax : null,
  ].filter((n): n is number => typeof n === 'number');
  return targets.some((target) => Math.abs(target - sum) < 0.015);
}

function totalsMatch(receipt: ParsedReceipt): boolean {
  return itemsMatchTotal(sumItems(receipt), receipt);
}

function mismatch(receipt: ParsedReceipt): number {
  const target = receipt.subtotal ?? receipt.total_amount ?? 0;
  return Math.abs(target - (sumItems(receipt) - (receipt.order_discounts ?? 0)));
}

async function callModel(
  openai: OpenAI,
  config: ModelConfig,
  imageUrls: string[]
): Promise<{ attempt: ParseAttempt; data: ParsedReceipt | null }> {
  const attempt: ParseAttempt = {
    model: config.model,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
    finish_reason: null,
    response_text: null,
    error: null,
    items_parsed: 0,
    totals_match: false,
  };

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      reasoning_effort: config.reasoning_effort,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_schema', json_schema: RECEIPT_SCHEMA },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: imageUrls.length > 1 ? PROMPT + multiPartNote(imageUrls.length) : PROMPT,
            },
            ...imageUrls.map((url) => ({
              type: 'image_url' as const,
              image_url: { url, detail: 'high' as const },
            })),
          ],
        },
      ],
    });

    const choice = response.choices[0];
    const usage = response.usage;
    const [inputPrice, outputPrice] = PRICES[config.model];
    attempt.prompt_tokens = usage?.prompt_tokens ?? 0;
    attempt.completion_tokens = usage?.completion_tokens ?? 0;
    attempt.total_tokens = usage?.total_tokens ?? 0;
    attempt.estimated_cost =
      (attempt.prompt_tokens * inputPrice + attempt.completion_tokens * outputPrice) / 1e6;
    attempt.finish_reason = choice.finish_reason;
    attempt.response_text = choice.message.content;

    if (choice.message.refusal) throw new Error(`Model refused: ${choice.message.refusal}`);
    if (choice.finish_reason === 'length') throw new Error('Response was cut off');
    if (!choice.message.content) throw new Error('No response from AI');

    // Structured outputs guarantee this parses and matches the schema
    const data = JSON.parse(choice.message.content) as ParsedReceipt;
    attempt.items_parsed = data.items.length;
    attempt.totals_match = totalsMatch(data);
    return { attempt, data };
  } catch (error) {
    attempt.error = error instanceof Error ? error.message : String(error);
    return { attempt, data: null };
  }
}

// Parses with the primary model, and asks the fallback model for a second
// opinion when the primary fails or its items don't add up to the total.
// Pass several URLs when one receipt was photographed in parts.
export async function parseReceiptImages(
  imageUrls: string[],
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
): Promise<ParseResult> {
  const primary = await callModel(openai, PRIMARY, imageUrls);
  const attempts = [primary.attempt];
  let best = primary.data;

  if (!best || !primary.attempt.totals_match) {
    const fallback = await callModel(openai, FALLBACK, imageUrls);
    attempts.push(fallback.attempt);

    if (fallback.data) {
      const fallbackIsBetter =
        !best ||
        fallback.attempt.totals_match ||
        mismatch(fallback.data) < mismatch(best);
      if (fallbackIsBetter) best = fallback.data;
    }
  }

  return {
    data: best,
    attempts,
    itemsSum: best ? sumItems(best) : 0,
    totalsMatch: best ? totalsMatch(best) : false,
  };
}
