import { createClient } from '@/lib/supabase/client';

// The parser's vision model scales images to fit 2048px anyway, so anything
// larger just costs upload time and storage
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;
// Fallback limit for files the browser can't decode for resizing
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

export type UploadStage = 'preparing' | 'uploading' | 'parsing';

export interface ParsedReceiptSummary {
  receiptId: string;
  storeName: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  itemCount: number;
  needsReview: boolean;
  warning: string | null;
}

// Resizes to fit MAX_DIMENSION and re-encodes as JPEG. Drawing to a canvas
// applies the photo's EXIF rotation and drops the rest of its metadata
// (including GPS location), so stored images are upright and private.
export async function prepareImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // e.g. HEIC in browsers that can't decode it
    if (file.size > MAX_ORIGINAL_BYTES) {
      throw new Error(
        "This image format couldn't be read. Try exporting it as a JPEG."
      );
    }
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to process image'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  );
}

// Uploads a receipt's photo(s), creates the receipt and parses it. Pass
// several files when one long receipt was photographed in parts. If anything
// fails after uploading, the receipt and images are removed again so a
// failed attempt leaves nothing behind.
export async function uploadAndParseReceipt(
  files: File | File[],
  onStage?: (stage: UploadStage) => void
): Promise<ParsedReceiptSummary> {
  const supabase = createClient();
  const fileList = Array.isArray(files) ? files : [files];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload receipts');

  onStage?.('preparing');
  const images = await Promise.all(fileList.map(prepareImage));

  onStage?.('uploading');
  const filePaths: string[] = [];
  let receiptId: string | null = null;
  try {
    for (const [index, image] of images.entries()) {
      const extension =
        image.type === 'image/jpeg' ? 'jpg' : fileList[index].name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('receipt-images')
        .upload(filePath, image, { contentType: image.type || fileList[index].type });
      if (uploadError) throw uploadError;
      filePaths.push(filePath);
    }

    const [imageUrl, ...additionalImageUrls] = filePaths.map(
      (path) => supabase.storage.from('receipt-images').getPublicUrl(path).data.publicUrl
    );

    const { data: receipt, error: insertError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        additional_image_urls: additionalImageUrls,
        store_name: null,
        purchase_date: null, // Filled in by the parser if the date is readable
        total_amount: 0,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    receiptId = receipt.id;

    onStage?.('parsing');
    const response = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Failed to parse receipt (HTTP ${response.status})`);
    }

    return toSummary(receipt.id, result);
  } catch (error) {
    try {
      if (receiptId) await supabase.from('receipts').delete().eq('id', receiptId);
      if (filePaths.length > 0) {
        await supabase.storage.from('receipt-images').remove(filePaths);
      }
    } catch (cleanupError) {
      console.error('Failed to clean up after error:', cleanupError);
    }
    throw error;
  }
}

interface ParseResponse {
  data?: {
    store_name?: string | null;
    purchase_date?: string | null;
    total_amount?: number | null;
    items?: unknown[];
  };
  needsReview?: boolean;
  warning?: string | null;
}

function toSummary(receiptId: string, result: ParseResponse): ParsedReceiptSummary {
  return {
    receiptId,
    storeName: result.data?.store_name ?? null,
    purchaseDate: result.data?.purchase_date ?? null,
    totalAmount: result.data?.total_amount ?? null,
    itemCount: result.data?.items?.length ?? 0,
    needsReview: Boolean(result.needsReview),
    warning: result.warning ?? null,
  };
}

// Combines receipts that are really parts of one long receipt into the first
// one, re-parsing it from all of their photos
export async function mergeReceipts(receiptIds: string[]): Promise<ParsedReceiptSummary> {
  const response = await fetch('/api/merge-receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptIds }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Failed to combine receipts (HTTP ${response.status})`);
  }
  return toSummary(result.receiptId, result);
}

// A photo of only part of a long receipt parses without a total (top half)
// or without a store name (bottom half), and its items can't add up
export function looksLikePartOfReceipt(receipt: ParsedReceiptSummary): boolean {
  const missingTotal = !receipt.totalAmount;
  const missingStore = !receipt.storeName || receipt.storeName === 'Unknown';
  return receipt.needsReview && (missingTotal || missingStore);
}

export interface PossibleDuplicate {
  id: string;
  storeName: string | null;
  purchaseDate: string | null;
}

// Another receipt from the same store with the same total is probably the
// same receipt uploaded twice. Dates only rule a match out when both exist,
// since many receipts have no readable date.
export async function findPossibleDuplicate(
  receipt: ParsedReceiptSummary
): Promise<PossibleDuplicate | null> {
  if (!receipt.totalAmount) return null;

  const supabase = createClient();
  let query = supabase
    .from('receipts')
    .select('id, store_name, purchase_date')
    .neq('id', receipt.receiptId)
    .eq('total_amount', receipt.totalAmount);
  if (receipt.storeName) query = query.ilike('store_name', receipt.storeName);

  const { data, error } = await query;
  if (error || !data) return null;

  const match = data.find(
    (other) =>
      !other.purchase_date ||
      !receipt.purchaseDate ||
      other.purchase_date === receipt.purchaseDate
  );
  return match
    ? { id: match.id, storeName: match.store_name, purchaseDate: match.purchase_date }
    : null;
}
