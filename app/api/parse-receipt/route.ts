import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { enhanceWithMatches } from '@/lib/receipt-matching';
import { parseReceiptImage, type ParseAttempt } from '@/lib/receipt-parser';

// A primary parse plus a fallback can take over a minute on long receipts
export const maxDuration = 120;

// Helper function to get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// Accepts only real calendar dates in YYYY-MM-DD format
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Log each model call; a failed log shouldn't fail the parse
async function logAttempts(
  supabase: SupabaseClient,
  userId: string,
  receiptId: string,
  attempts: ParseAttempt[],
  itemsEnhanced: number,
  finalError: string | null
) {
  const rows = attempts.map((attempt) => ({
    user_id: userId,
    receipt_id: receiptId,
    model: attempt.model,
    prompt_tokens: attempt.prompt_tokens,
    completion_tokens: attempt.completion_tokens,
    total_tokens: attempt.total_tokens,
    estimated_cost: attempt.estimated_cost,
    response_text: attempt.response_text,
    finish_reason: attempt.finish_reason,
    was_truncated: attempt.finish_reason === 'length',
    items_parsed: attempt.items_parsed,
    items_enhanced: itemsEnhanced,
    parsing_successful: !attempt.error && !finalError,
    error_message:
      attempt.error ??
      (attempt.items_parsed && !attempt.totals_match
        ? "Items don't add up to the receipt total"
        : finalError),
  }));

  const { error } = await supabase.from('api_logs').insert(rows);
  if (error) console.error('Failed to log API calls:', error);
}

export async function POST(request: Request) {
  const { receiptId } = await request.json();

  if (!receiptId) {
    return NextResponse.json(
      { error: 'Receipt ID is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    return NextResponse.json({ error: 'Receipt has no image' }, { status: 400 });
  }

  const result = await parseReceiptImage(receipt.image_url);
  let itemsEnhanced = 0;

  try {
    const parsedData = result.data;
    if (!parsedData) {
      throw new Error(
        result.attempts.at(-1)?.error || 'Failed to parse receipt'
      );
    }

    if (parsedData.items.length === 0) {
      throw new Error(
        'No items were extracted from the receipt. The image may be unclear.'
      );
    }

    // Fill in missing brand/size/etc. from items the user has bought before
    const { data: historicalItems } = await supabase
      .from('receipt_items')
      .select(
        'receipt_text, generic_name, brand, variant, size, unit, category, receipts!inner(user_id)'
      )
      .eq('receipts.user_id', user.id)
      .not('receipt_text', 'is', null)
      .limit(500);

    let items = parsedData.items;
    if (historicalItems && historicalItems.length > 0) {
      const enhanced = enhanceWithMatches(items, historicalItems);
      items = enhanced.items;
      itemsEnhanced = enhanced.enhancedCount;
    }

    // Update receipt with parsed data. If the date isn't readable, keep the
    // existing one (e.g. entered by hand) rather than guessing today's date.
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        store_name: parsedData.store_name || 'Unknown',
        purchase_date: isValidDate(parsedData.purchase_date)
          ? parsedData.purchase_date
          : receipt.purchase_date,
        total_amount: parsedData.total_amount || 0,
        raw_text: JSON.stringify(parsedData),
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Failed to update receipt:', updateError);
      throw new Error('Failed to update receipt');
    }

    const itemsToInsert = items.map((item) => ({
      receipt_id: receiptId,
      item_name: item.item_name || 'Unknown Item',
      receipt_text: item.receipt_text || null,
      brand: item.brand || null,
      generic_name: item.generic_name || null,
      variant: item.variant || null,
      size: item.size || null,
      unit: item.unit || null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      total_price: item.total_price || 0,
      was_on_sale: item.was_on_sale,
      category: item.category || 'other',
    }));

    // Only remove the old items once the new parse has succeeded, so a failed
    // re-parse leaves the receipt as it was
    const { error: deleteItemsError } = await supabase
      .from('receipt_items')
      .delete()
      .eq('receipt_id', receiptId);

    if (deleteItemsError) {
      console.error('Error deleting existing items:', deleteItemsError);
      throw new Error('Failed to replace existing items');
    }

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Failed to insert items:', itemsError);
      throw new Error('Failed to insert items');
    }

    await logAttempts(supabase, user.id, receiptId, result.attempts, itemsEnhanced, null);

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: `Receipt parsed successfully - ${items.length} items extracted`,
      needsReview: !result.totalsMatch,
      warning: result.totalsMatch
        ? null
        : `The items add up to $${result.itemsSum.toFixed(2)}, which doesn't match the receipt total of $${(parsedData.total_amount ?? 0).toFixed(2)}. Please check the prices.`,
    });
  } catch (error: unknown) {
    console.error('Error parsing receipt:', error);
    await logAttempts(
      supabase,
      user.id,
      receiptId,
      result.attempts,
      itemsEnhanced,
      getErrorMessage(error)
    );

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
