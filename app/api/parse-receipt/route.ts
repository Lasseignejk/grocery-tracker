import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { enhanceWithMatches } from '@/lib/receipt-matching';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export async function POST(request: Request) {
  let user: any = null;
  let receiptId: string | null = null;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let estimatedCost = 0;
  let content: string | null = null;
  let finishReason: string | null = null;
  let wasTruncated = false;

  try {
    const { receiptId: requestReceiptId } = await request.json();
    receiptId = requestReceiptId;

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;

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
      max_tokens: 4096,
      temperature: 0,
    });

    content = response.choices[0].message.content;
    finishReason = response.choices[0].finish_reason;
    wasTruncated = finishReason === 'length';

    // Get token usage
    const usage = response.usage;
    promptTokens = usage?.prompt_tokens || 0;
    completionTokens = usage?.completion_tokens || 0;
    totalTokens = usage?.total_tokens || 0;

    // Calculate estimated cost (GPT-4o pricing)
    estimatedCost = promptTokens * 0.0000025 + completionTokens * 0.00001;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response with better error handling
    let parsedData;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Remove any comments
      cleanContent = cleanContent.replace(/\/\/.*$/gm, '');
      cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '');

      // Remove trailing commas
      cleanContent = cleanContent.replace(/,(\s*[}\]])/g, '$1');

      // If response was truncated, try to fix incomplete JSON
      if (wasTruncated) {
        console.log('Response was truncated, attempting to fix JSON...');

        // Check if we're in the middle of an items array
        const itemsMatch = cleanContent.match(/"items"\s*:\s*\[/);
        if (itemsMatch) {
          // Find the last complete item (ending with })
          const lastCompleteItemIndex = cleanContent.lastIndexOf('}');
          if (lastCompleteItemIndex > -1) {
            // Truncate to last complete item and close the JSON properly
            cleanContent = cleanContent.substring(0, lastCompleteItemIndex + 1);

            // Count opening brackets to close properly
            const openBrackets = (cleanContent.match(/\[/g) || []).length;
            const closeBrackets = (cleanContent.match(/\]/g) || []).length;
            const openBraces = (cleanContent.match(/\{/g) || []).length;
            const closeBraces = (cleanContent.match(/\}/g) || []).length;

            // Close items array if needed
            if (openBrackets > closeBrackets) {
              cleanContent += ']';
            }

            // Close main object if needed
            if (openBraces > closeBraces) {
              cleanContent += '}';
            }
          }
        }
      }

      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      console.error('Parse error:', parseError);

      // Log the parsing error
      try {
        await supabase.from('api_logs').insert({
          user_id: user.id,
          receipt_id: receiptId,
          model: 'gpt-4o',
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          response_text: content,
          finish_reason: finishReason,
          was_truncated: wasTruncated,
          items_parsed: 0,
          parsing_successful: false,
          error_message: getErrorMessage(parseError),
          estimated_cost: estimatedCost,
        });
      } catch (logError) {
        console.error('Failed to log parsing error:', logError);
      }

      throw new Error(
        wasTruncated
          ? 'Response was truncated - receipt may be too long'
          : 'JSON parsing failed'
      );
    }

    // Validate the parsed data structure
    if (!parsedData.items || !Array.isArray(parsedData.items)) {
      throw new Error('Invalid response structure: missing items array');
    }

    //  Fetch historical items for matching
    const { data: historicalItems } = await supabase
      .from('receipt_items')
      .select(
        'receipt_text, generic_name, brand, variant, size, unit, category, receipts!inner(user_id)'
      )
      .eq('receipts.user_id', user.id)
      .not('receipt_text', 'is', null)
      .limit(500);

    // Enhance parsed items with historical matches
    let itemsEnhanced = 0;
    if (historicalItems && historicalItems.length > 0) {
      const result = enhanceWithMatches(parsedData.items, historicalItems);
      parsedData.items = result.items;
      itemsEnhanced = result.enhancedCount;
    }

    // Check if we got valid items
    if (parsedData.items.length === 0) {
      throw new Error(
        'No items were extracted from the receipt. The image may be unclear.'
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
      throw new Error('Failed to update receipt');
    }

    // Insert new items
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
      throw new Error('Failed to insert items');
    }

    // Log successful parsing
    try {
      await supabase.from('api_logs').insert({
        user_id: user.id,
        receipt_id: receiptId,
        model: 'gpt-4o',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        response_text: content,
        finish_reason: finishReason,
        was_truncated: wasTruncated,
        items_parsed: parsedData.items?.length || 0,
        items_enhanced: itemsEnhanced, // ✅ Now we track it!
        parsing_successful: true,
        error_message: null,
        estimated_cost: estimatedCost,
      });
    } catch (logError) {
      // Don't fail the whole request if logging fails
      console.error('Failed to log API call:', logError);
    }

    // Return success with truncation warning if applicable
    return NextResponse.json({
      success: true,
      data: parsedData,
      message: `Receipt parsed successfully - ${parsedData.items.length} items extracted`,
      truncated: wasTruncated,
      warning: wasTruncated
        ? `This receipt may have more items than shown. We extracted ${parsedData.items.length} items, but the receipt might be longer. Please review and add any missing items manually.`
        : null,
    });
  } catch (error: unknown) {
    console.error('Error parsing receipt:', error);

    // Log the error if we have the necessary info
    if (user && receiptId) {
      try {
        const supabase = await createClient();
        await supabase.from('api_logs').insert({
          user_id: user.id,
          receipt_id: receiptId,
          model: 'gpt-4o',
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          response_text: content,
          finish_reason: finishReason,
          was_truncated: wasTruncated,
          items_parsed: 0,
          parsing_successful: false,
          error_message: getErrorMessage(error),
          estimated_cost: estimatedCost,
        });
      } catch (logError) {
        console.error('Failed to log API error:', logError);
      }
    }

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
