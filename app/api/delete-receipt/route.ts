import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    // Delete the image from storage if it exists
    if (receipt.image_url) {
      // Extract the file path from the URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/receipt-images/user_id/filename.jpg
      const urlParts = receipt.image_url.split('/receipt-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];

        const { error: storageError } = await supabase.storage
          .from('receipt-images')
          .remove([filePath]);

        if (storageError) {
          console.error('Error deleting image from storage:', storageError);
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
  } catch (error: any) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete receipt' },
      { status: 500 }
    );
  }
}
