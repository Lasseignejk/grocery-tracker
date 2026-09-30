import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';
import { parseAndSaveReceipt } from '@/lib/receipt-processing';

// A primary parse plus a fallback can take over a minute on long receipts
export const maxDuration = 120;

// Combines receipts that are really photos of one long receipt. The first
// receipt is kept and gets every photo (in the given order); it's re-parsed
// from all of them, and the others are deleted only once that succeeds.
export async function POST(request: Request) {
  const { receiptIds } = await request.json();

  if (
    !Array.isArray(receiptIds) ||
    receiptIds.length < 2 ||
    new Set(receiptIds).size !== receiptIds.length
  ) {
    return NextResponse.json(
      { error: 'At least two different receipt IDs are required' },
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

  const { data: found, error: fetchError } = await supabase
    .from('receipts')
    .select('*')
    .in('id', receiptIds)
    .eq('user_id', user.id);

  if (fetchError || !found || found.length !== receiptIds.length) {
    return NextResponse.json(
      { error: 'Receipts not found or access denied' },
      { status: 404 }
    );
  }

  const ordered = receiptIds.map((id: string) => found.find((r) => r.id === id)!);
  const [primary, ...others] = ordered;
  const combinedExtras = [
    ...primary.additional_image_urls,
    ...others.flatMap((r) => [r.image_url, ...r.additional_image_urls]),
  ].filter((url): url is string => Boolean(url));

  const { error: updateError } = await supabase
    .from('receipts')
    .update({ additional_image_urls: combinedExtras })
    .eq('id', primary.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to combine photos' }, { status: 500 });
  }

  let result;
  try {
    result = await parseAndSaveReceipt(supabase, user.id, {
      ...primary,
      additional_image_urls: combinedExtras,
    });
  } catch (error: unknown) {
    // Put the photos back so each receipt is exactly as it was
    await supabase
      .from('receipts')
      .update({ additional_image_urls: primary.additional_image_urls })
      .eq('id', primary.id);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }

  const otherIds = others.map((r) => r.id);

  // Keep the pieces' parse costs in the API logs, which would otherwise be
  // deleted along with them
  await supabase.from('api_logs').update({ receipt_id: primary.id }).in('receipt_id', otherIds);

  // Their photos now belong to the combined receipt, so only the rows go
  const { error: deleteError } = await supabase
    .from('receipts')
    .delete()
    .in('id', otherIds)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Failed to delete merged receipts:', deleteError);
  }

  return NextResponse.json({
    success: true,
    receiptId: primary.id,
    data: result.data,
    itemCount: result.itemCount,
    needsReview: result.needsReview,
    warning: result.warning,
  });
}
