import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getErrorMessage, parseAndSaveReceipt } from '@/lib/receipt-processing';

// A primary parse plus a fallback can take over a minute on long receipts
export const maxDuration = 120;

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

  try {
    const result = await parseAndSaveReceipt(supabase, user.id, receipt);
    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Receipt parsed successfully - ${result.itemCount} items extracted`,
      needsReview: result.needsReview,
      warning: result.warning,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
