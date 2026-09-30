import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';

export async function DELETE(request: Request) {
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

    // Get receipt to verify ownership and get image URL
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the receipt's photos from storage, except any another receipt
    // still uses (e.g. after an interrupted merge)
    const imageUrls = [receipt.image_url, ...receipt.additional_image_urls].filter(
      (url): url is string => Boolean(url)
    );
    if (imageUrls.length > 0) {
      const { data: sharing, error: sharingError } = await supabase
        .from('receipts')
        .select('image_url, additional_image_urls')
        .neq('id', receiptId)
        .or(
          `image_url.in.(${imageUrls.map((u) => `"${u}"`).join(',')}),additional_image_urls.ov.{${imageUrls.map((u) => `"${u}"`).join(',')}}`
        );
      const stillUsed = new Set(
        (sharing ?? []).flatMap((r) => [r.image_url, ...r.additional_image_urls])
      );

      // URL format: https://xxx.supabase.co/storage/v1/object/public/receipt-images/user_id/filename.jpg
      // If we can't tell which photos are shared, keep them all
      const filePaths = (sharingError ? [] : imageUrls)
        .filter((url) => !stillUsed.has(url))
        .map((url) => url.split('/receipt-images/')[1])
        .filter(Boolean);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('receipt-images')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting images from storage:', storageError);
          // Continue with receipt deletion even if image deletion fails
        }
      }
    }

    // Delete the receipt (items will be deleted automatically via CASCADE)
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting receipt:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete receipt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt and associated items deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete receipt') },
      { status: 500 }
    );
  }
}
