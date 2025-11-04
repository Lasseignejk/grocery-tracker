import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { receiptId } = await request.json();

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (!receipt.image_url) {
      return NextResponse.json(
        { error: 'Receipt has no image' },
        { status: 400 }
      );
    }

    // Delete existing items before re-parsing
    const { error: deleteItemsError } = await supabase
      .from('receipt_items')
      .delete()
      .eq('receipt_id', receiptId);

    if (deleteItemsError) {
      console.error('Error deleting existing items:', deleteItemsError);
    }

    // Call OpenAI GPT-4 Vision to parse the receipt
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this grocery receipt image and extract the following information in JSON format.

CRITICAL: Return ONLY valid JSON with NO comments, NO explanatory text, NO markdown formatting.

{
  "store_name": "name of the store",
  "purchase_date": "date in YYYY-MM-DD format or null if not visible",
  "total_amount": number,
  "items": [
    {
      "receipt_text": "EXACT text as it appears on the receipt",
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
      "category": "one of: produce, meat, dairy, bakery, beverages, snacks, household, personal-care, frozen, other"
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

CATEGORIES:
- produce: fruits, vegetables, herbs
- meat: meat, poultry, seafood, deli
- dairy and eggs: milk, cheese, yogurt, butter, eggs
- bakery: bread, pastries, cakes
- beverages: soda, juice, coffee, tea, alcohol
- snacks: chips, candy, cookies, bars
- household: cleaning, paper products
- personal-care: soap, shampoo, cosmetics
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
- Extract ALL items from the receipt - do not truncate

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
}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: receipt.image_url,
              },
            },
          ],
        },
      ],
      max_tokens: 4096, // ✅ Increased from 2000
      temperature: 0,
    });

    const content = response.choices[0].message.content;

    // Check if response was truncated
    const finishReason = response.choices[0].finish_reason;
    if (finishReason === 'length') {
      console.error('Response was truncated due to token limit');
      return NextResponse.json(
        {
          error:
            'Receipt too long - parsing was incomplete. The receipt has too many items to process in one go. Try taking a clearer photo with fewer items visible, or manually add the remaining items.',
          truncated: true,
        },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse JSON response with better error handling
    let parsedData;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Remove any comments (// or /* */)
      cleanContent = cleanContent.replace(/\/\/.*$/gm, '');
      cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '');

      // Remove trailing commas before closing braces/brackets
      cleanContent = cleanContent.replace(/,(\s*[}\]])/g, '$1');

      parsedData = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      console.error('Parse error:', e);

      // Check if it looks like truncated JSON
      if (content.includes('"items":') && !content.trim().endsWith('}')) {
        return NextResponse.json(
          {
            error:
              'Receipt parsing was incomplete - response appears truncated. The receipt may be too long. Try re-parsing or manually add missing items.',
            details:
              'JSON parsing failed - response was likely cut off mid-stream',
            truncated: true,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to parse AI response. The AI returned invalid JSON.',
          details: content.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // Validate the parsed data structure
    if (!parsedData.items || !Array.isArray(parsedData.items)) {
      return NextResponse.json(
        { error: 'Invalid response structure: missing items array' },
        { status: 500 }
      );
    }

    // Check if items array is empty or suspiciously small
    if (parsedData.items.length === 0) {
      return NextResponse.json(
        {
          error:
            'No items were extracted from the receipt. The image may be unclear or the AI could not read it.',
        },
        { status: 400 }
      );
    }

    // Update receipt with parsed data
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        store_name: parsedData.store_name || 'Unknown',
        purchase_date:
          parsedData.purchase_date || new Date().toISOString().split('T')[0],
        total_amount: parsedData.total_amount || 0,
        raw_text: JSON.stringify(parsedData),
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Failed to update receipt:', updateError);
      return NextResponse.json(
        { error: 'Failed to update receipt' },
        { status: 500 }
      );
    }

    // Insert new items
    if (parsedData.items.length > 0) {
      const itemsToInsert = parsedData.items.map((item: any) => ({
        receipt_id: receiptId,
        item_name: item.item_name || 'Unknown Item',
        receipt_text: item.receipt_text || null,
        brand: item.brand || null,
        generic_name: item.generic_name || null,
        variant: item.variant || null,
        size: item.size || null,
        unit: item.unit || null,
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
        was_on_sale: Boolean(item.was_on_sale),
        category: item.category || 'other',
      }));

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Failed to insert items:', itemsError);
        return NextResponse.json(
          { error: 'Failed to insert items' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: `Receipt parsed successfully - ${parsedData.items.length} items extracted`,
    });
  } catch (error: any) {
    console.error('Error parsing receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse receipt' },
      { status: 500 }
    );
  }
}
